import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { AutomationTask } from '@prisma/client';
import type { Page } from 'playwright';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';

const DEFAULT_WEB_CHECK_INTERVAL_MS = 60_000;
const DEFAULT_WEB_CHECK_BATCH_SIZE = 3;
const DEFAULT_WEB_CHECK_TIMEOUT_MS = 45_000;
const DEFAULT_IP_CHECK_URLS = [
  'https://ipapi.co/json/',
  'https://ipwho.is/',
  'https://api.country.is/'
];

interface AppleWebCheckExecutionPlan {
  countryCode: string;
  accountRegion: string;
  exitCountry: string;
  locale: string;
  timezone: string;
  appleAccountSignInUrl: string;
}

interface AppleWebManualInput {
  inputType: 'verification_code' | 'captcha' | 'device_confirmation' | 'note';
  value: string;
}

type AppleWebCheckResultStatus =
  | 'normal'
  | 'need_verify'
  | 'locked'
  | 'password_error'
  | 'risk'
  | 'unknown';

@Injectable()
export class AppleWebCheckWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppleWebCheckWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly automationTasksService: AppleAutomationTasksService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  onModuleInit() {
    if (process.env.APPLE_WEB_CHECK_WORKER_ENABLED !== 'true') return;

    const intervalMs = this.getIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    if (process.env.APPLE_WEB_CHECK_WORKER_RUN_ON_STARTUP === 'true') {
      void this.runOnce();
    }

    this.logger.log(`Apple web check worker enabled, interval=${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async runOnce() {
    if (this.running) return;
    this.running = true;

    try {
      const tasks = await this.prisma.automationTask.findMany({
        where: {
          taskType: 'check_status',
          status: 'queued',
          manualRequired: false,
          appleAccountId: { not: null }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: this.getBatchSize()
      });

      for (const task of tasks) {
        await this.runTask(task).catch((error) => {
          this.logger.error(
            error instanceof Error ? error.message : `Apple web check task ${task.id} failed`
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async runTask(task: AutomationTask) {
    const locked = await this.prisma.automationTask.updateMany({
      where: { id: task.id, status: 'queued' },
      data: {
        status: 'running',
        startedAt: new Date(),
        errorCode: null,
        errorMessage: null
      }
    });

    if (locked.count !== 1) return;

    const plan = this.getExecutionPlan(task);
    const account = await this.prisma.appleAccount.findFirst({
      where: { id: task.appleAccountId ?? '', deletedAt: null },
      select: {
        id: true,
        appleId: true,
        passwordEncrypted: true
      }
    });

    if (!account) {
      await this.automationTasksService.markManual(task.id, {
        reason: 'Apple ID 不存在或已删除，无法执行官网检查'
      });
      return;
    }

    const password = this.fieldEncryptionService.decrypt(account.passwordEncrypted);
    if (!password) {
      await this.automationTasksService.markManual(task.id, {
        reason: 'Apple ID 未保存密码，无法执行官网检查'
      });
      return;
    }

    const gatewayContext = await this.automationTasksService.webCheckGateways(task.id);
    if (!gatewayContext.gatewayConfigured) {
      await this.automationTasksService.markManual(task.id, {
        reason: `缺少 ${plan.countryCode} 出口节点配置`
      });
      return;
    }

    const candidates = gatewayContext.candidates.filter(
      (candidate) =>
        candidate.countryCode === plan.countryCode && candidate.status !== 'unavailable'
    );
    const runnableCandidates = candidates.length
      ? candidates
      : gatewayContext.fallbackGatewayProfileCode
        ? [
            {
              id: gatewayContext.fallbackGatewayProfileCode,
              name: gatewayContext.fallbackGatewayProfileCode,
              countryCode: plan.countryCode,
              status: 'unknown' as const,
              protocol: null,
              hasEncryptedConfig: false,
              latencyMs: null,
              lastCheckedAt: null,
              failureReason: null
            }
          ]
        : [];

    if (!runnableCandidates.length) {
      await this.automationTasksService.markManual(task.id, {
        reason: `没有可用的 ${plan.countryCode} 出口节点候选`
      });
      return;
    }

    for (const candidate of runnableCandidates) {
      const switched = await this.switchSingBoxSelector(candidate.id);
      if (!switched) {
        await this.automationTasksService.recordWebCheckGatewayAttempt(task.id, {
          nodeId: candidate.id,
          status: 'failed',
          failureReason: 'sing-box selector 切换失败'
        });
        continue;
      }

      const attempt = await this.runWithBrowser({
        taskId: task.id,
        appleId: account.appleId,
        password,
        plan,
        nodeId: candidate.id,
        manualInput: this.getManualInput(task)
      });

      if (attempt.completed) return;
    }
  }

  private async runWithBrowser(input: {
    taskId: string;
    appleId: string;
    password: string;
    plan: AppleWebCheckExecutionPlan;
    nodeId: string;
    manualInput: AppleWebManualInput | null;
  }) {
    const { chromium } = await import('playwright');
    const timeoutMs = this.getTimeoutMs();
    const browser = await chromium.launch({
      headless: process.env.APPLE_WEB_CHECK_HEADLESS !== 'false',
      proxy: this.getPlaywrightProxy()
    });

    try {
      const context = await browser.newContext({
        locale: input.plan.locale,
        timezoneId: input.plan.timezone
      });
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      const exitCheck = await this.checkExitCountry(page, input.plan.countryCode);
      const attemptResult = await this.automationTasksService.recordWebCheckGatewayAttempt(
        input.taskId,
        {
          nodeId: input.nodeId,
          status: exitCheck.matched ? 'success' : 'failed',
          exitIp: exitCheck.ip,
          exitCountry: exitCheck.countryCode,
          latencyMs: exitCheck.latencyMs,
          failureReason: exitCheck.matched
            ? null
            : `出口国家不匹配：期望 ${input.plan.countryCode}，实际 ${
                exitCheck.countryCode ?? 'UNKNOWN'
              }`
        }
      );

      if (!exitCheck.matched) {
        return { completed: attemptResult.remainingCandidateIds.length === 0 };
      }

      const result = await this.checkAppleAccountStatus(page, input);
      if ('manualReason' in result && result.manualReason) {
        await this.automationTasksService.markManual(input.taskId, {
          reason: result.manualReason
        });
        return { completed: true };
      }

      if (!('resultStatus' in result)) {
        await this.automationTasksService.markManual(input.taskId, {
          reason: 'Apple 官网页面结果无法稳定判断，已转人工确认'
        });
        return { completed: true };
      }

      await this.automationTasksService.writeResult(input.taskId, {
        status: 'success',
        resultPayload: {
          resultStatus: result.resultStatus,
          source: 'apple_web_worker',
          adapterVersion: process.env.APPLE_WEB_CHECK_ADAPTER_VERSION || 'apple-web-v1',
          exitCountry: input.plan.countryCode,
          checkedAt: new Date().toISOString()
        }
      });
      return { completed: true };
    } finally {
      await browser.close();
    }
  }

  private async checkExitCountry(page: Page, expectedCountry: string) {
    let lastResult: {
      countryCode: string | null;
      ip: string | null;
      latencyMs: number;
      matched: boolean;
    } | null = null;

    for (const url of this.getIpCheckUrls()) {
      const startedAt = Date.now();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
      const text = response ? await response.text() : ((await page.textContent('body')) ?? '{}');
      const data = this.safeJsonParse(text);
      const countryCode = this.getCountryCode(data);
      const result = {
        countryCode,
        ip: this.getNullableString(data.ip),
        latencyMs: Date.now() - startedAt,
        matched: countryCode === expectedCountry
      };
      lastResult = result;

      if (countryCode) return result;
    }

    return (
      lastResult ?? {
        countryCode: null,
        ip: null,
        latencyMs: 0,
        matched: false
      }
    );
  }

  private async checkAppleAccountStatus(
    page: Page,
    input: {
      appleId: string;
      password: string;
      plan: AppleWebCheckExecutionPlan;
      manualInput: AppleWebManualInput | null;
    }
  ): Promise<
    { resultStatus: AppleWebCheckResultStatus; manualReason?: null } | { manualReason: string }
  > {
    await page.goto(input.plan.appleAccountSignInUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const emailInput = await this.findFirstVisibleLocator(page, [
      'input[type="email"]',
      'input[name="accountName"]',
      '#account_name_text_field',
      'input[id*="account"]'
    ]);

    if (!emailInput) {
      return { manualReason: 'Apple 登录页账号输入框无法识别，需要更新 Worker adapter' };
    }

    await emailInput.fill(input.appleId);
    await this.clickFirstVisibleLocator(page, [
      'button[type="submit"]',
      'button:has-text("Continue")',
      'button:has-text("继续")',
      '#sign-in'
    ]);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const passwordInput = await this.findFirstVisibleLocator(page, [
      'input[type="password"]',
      'input[name="password"]',
      '#password_text_field'
    ]);

    if (!passwordInput) {
      const pageText = await this.getPageText(page);
      if (this.isManualChallengeText(pageText)) {
        return { manualReason: 'Apple 要求人工验证或验证码，已停止等待人工处理' };
      }
      return { manualReason: 'Apple 登录页密码输入框无法识别，需要更新 Worker adapter' };
    }

    await passwordInput.fill(input.password);
    await this.clickFirstVisibleLocator(page, [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("登录")',
      'button:has-text("继续")',
      '#sign-in'
    ]);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const pageText = await this.getPageText(page);
    if (this.isManualChallengeText(pageText)) {
      const manualInputUsed = await this.trySubmitManualChallengeInput(page, input.manualInput);
      if (manualInputUsed) {
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const nextPageText = await this.getPageText(page);
        if (!this.isManualChallengeText(nextPageText)) {
          return this.resolveSignedInStatus(page, nextPageText);
        }
      }
      return { manualReason: 'Apple 要求人工验证码、设备确认或 CAPTCHA，已停止等待人工处理' };
    }

    return this.resolveSignedInStatus(page, pageText);
  }

  private resolveSignedInStatus(
    page: Page,
    pageText: string
  ): { resultStatus: AppleWebCheckResultStatus; manualReason?: null } | { manualReason: string } {
    if (this.includesAny(pageText, ['incorrect password', '密码错误', 'password is incorrect'])) {
      return { resultStatus: 'password_error', manualReason: null };
    }
    if (this.includesAny(pageText, ['locked', 'disabled', '已锁定', '已停用'])) {
      return { resultStatus: 'locked', manualReason: null };
    }
    if (this.includesAny(pageText, ['security reasons', 'risk', '安全原因', '风险'])) {
      return { resultStatus: 'risk', manualReason: null };
    }
    if (
      this.includesAny(page.url().toLowerCase(), [
        'account.apple.com/account',
        'account.apple.com'
      ]) &&
      this.includesAny(pageText, [
        'personal information',
        'sign-out',
        'account security',
        '个人信息'
      ])
    ) {
      return { resultStatus: 'normal', manualReason: null };
    }

    return { manualReason: 'Apple 官网页面结果无法稳定判断，已转人工确认' };
  }

  private async trySubmitManualChallengeInput(page: Page, manualInput: AppleWebManualInput | null) {
    if (!manualInput || manualInput.inputType === 'note') return false;
    const value = manualInput.value.trim();
    if (!value) return false;

    const multiInputSubmitted = await this.tryFillSegmentedCodeInputs(page, value);
    if (!multiInputSubmitted) {
      const input = await this.findFirstVisibleLocator(page, [
        'input[type="tel"]',
        'input[inputmode="numeric"]',
        'input[name*="code" i]',
        'input[id*="code" i]',
        'input[autocomplete="one-time-code"]',
        'input[type="text"]'
      ]);
      if (!input) return false;
      await input.fill(value).catch(async () => {
        await input.type(value).catch(() => undefined);
      });
    }

    await this.clickFirstVisibleLocator(page, [
      'button[type="submit"]',
      'button:has-text("Verify")',
      'button:has-text("Continue")',
      'button:has-text("验证")',
      'button:has-text("继续")',
      '#sign-in'
    ]);
    return true;
  }

  private async tryFillSegmentedCodeInputs(page: Page, value: string) {
    const selectors = [
      'input[aria-label*="digit" i]',
      'input[id*="char" i]',
      'input[type="tel"]',
      'input[inputmode="numeric"]'
    ];

    for (const frame of page.frames()) {
      for (const selector of selectors) {
        const inputs = frame.locator(selector);
        const count = await inputs.count().catch(() => 0);
        if (count < 2 || count > value.length) continue;
        let filled = 0;
        for (let index = 0; index < Math.min(count, value.length); index += 1) {
          const input = inputs.nth(index);
          if (!(await input.isVisible().catch(() => false))) continue;
          await input.fill(value[index] ?? '').catch(() => undefined);
          filled += 1;
        }
        if (filled >= Math.min(count, value.length)) return true;
      }
    }

    return false;
  }

  private async switchSingBoxSelector(nodeId: string) {
    const apiUrl = process.env.APPLE_WEB_CHECK_SING_BOX_API_URL;
    const selector = process.env.APPLE_WEB_CHECK_SING_BOX_SELECTOR;
    if (!apiUrl || !selector) return true;

    try {
      const url = new URL(`/proxies/${encodeURIComponent(selector)}`, apiUrl);
      const secret = this.getNullableString(process.env.APPLE_WEB_CHECK_SING_BOX_API_SECRET);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { authorization: `Bearer ${secret}` } : {})
        },
        body: JSON.stringify({ name: nodeId })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getExecutionPlan(
    task: Pick<AutomationTask, 'resultPayload'>
  ): AppleWebCheckExecutionPlan {
    const payload = this.toObject(task.resultPayload);
    const executionPlan = this.toObject(payload?.executionPlan);
    const countryCode = this.normalizeCountry(this.getNullableString(executionPlan?.countryCode));
    const accountRegion = this.normalizeCountry(
      this.getNullableString(executionPlan?.accountRegion)
    );
    const exitCountry = this.normalizeCountry(this.getNullableString(executionPlan?.exitCountry));

    if (!countryCode || !accountRegion || !exitCountry) {
      throw new Error('Apple web check execution plan is missing');
    }

    return {
      countryCode,
      accountRegion,
      exitCountry,
      locale: this.getNullableString(executionPlan?.locale) ?? 'en-US',
      timezone: this.getNullableString(executionPlan?.timezone) ?? 'UTC',
      appleAccountSignInUrl:
        this.getNullableString(executionPlan?.appleAccountSignInUrl) ??
        'https://account.apple.com/sign-in'
    };
  }

  private getPlaywrightProxy() {
    const server = process.env.APPLE_WEB_CHECK_PROXY_SERVER;
    return server ? { server } : undefined;
  }

  private getManualInput(
    task: Pick<AutomationTask, 'inputPayloadEncrypted'>
  ): AppleWebManualInput | null {
    if (!task.inputPayloadEncrypted) return null;
    const decrypted = this.fieldEncryptionService.decrypt(task.inputPayloadEncrypted);
    if (!decrypted) return null;
    const payload = this.safeJsonParse(decrypted);
    const manualInput = this.toObject(payload.manualInput);
    const inputType = this.getNullableString(manualInput?.inputType);
    const value = this.getNullableString(manualInput?.value);
    if (!value) return null;
    if (
      inputType === 'verification_code' ||
      inputType === 'captcha' ||
      inputType === 'device_confirmation' ||
      inputType === 'note'
    ) {
      return { inputType: inputType as AppleWebManualInput['inputType'], value };
    }

    return { inputType: 'verification_code' as const, value };
  }

  private getIpCheckUrls() {
    const configuredUrl = this.getNullableString(process.env.APPLE_WEB_CHECK_IP_CHECK_URL);
    return Array.from(
      new Set(
        [configuredUrl, ...DEFAULT_IP_CHECK_URLS].filter((url): url is string => Boolean(url))
      )
    );
  }

  private async findFirstVisibleLocator(page: Page, selectors: string[]) {
    for (const selector of selectors) {
      for (const frame of page.frames()) {
        const locator = frame.locator(selector).first();
        if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
          return locator;
        }
      }
    }
    return null;
  }

  private async clickFirstVisibleLocator(page: Page, selectors: string[]) {
    const locator = await this.findFirstVisibleLocator(page, selectors);
    if (locator) {
      await locator.click().catch(() => undefined);
    }
  }

  private async getPageText(page: Page) {
    return ((await page.textContent('body').catch(() => '')) ?? '').toLowerCase();
  }

  private isManualChallengeText(value: string) {
    return this.includesAny(value, [
      'two-factor',
      'verification code',
      'captcha',
      'verify your identity',
      'trusted phone number',
      '验证码',
      '双重认证',
      '验证你的身份',
      '受信任电话号码'
    ]);
  }

  private includesAny(value: string, keywords: string[]) {
    return keywords.some((keyword) => value.includes(keyword.toLowerCase()));
  }

  private safeJsonParse(value: string) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private getCountryCode(data: Record<string, unknown>) {
    return this.normalizeCountry(
      this.getNullableString(data.country_code) ??
        this.getNullableString(data.countryCode) ??
        this.getNullableString(data.country)
    );
  }

  private normalizeCountry(value: string | null | undefined) {
    return (value ?? '').trim().toUpperCase() || null;
  }

  private getNullableString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private toObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private getIntervalMs() {
    const value = Number(process.env.APPLE_WEB_CHECK_WORKER_INTERVAL_MS);
    if (!Number.isFinite(value) || value < 30_000) return DEFAULT_WEB_CHECK_INTERVAL_MS;
    return Math.floor(value);
  }

  private getBatchSize() {
    const value = Number(process.env.APPLE_WEB_CHECK_WORKER_MAX_BATCH);
    if (!Number.isInteger(value) || value <= 0 || value > 20) return DEFAULT_WEB_CHECK_BATCH_SIZE;
    return value;
  }

  private getTimeoutMs() {
    const value = Number(process.env.APPLE_WEB_CHECK_TIMEOUT_MS);
    if (!Number.isFinite(value) || value < 10_000) return DEFAULT_WEB_CHECK_TIMEOUT_MS;
    return Math.floor(value);
  }
}
