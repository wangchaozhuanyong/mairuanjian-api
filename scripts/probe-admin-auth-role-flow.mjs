#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.ADMIN_UI_BASE_URL ?? 'http://127.0.0.1:5374';
const outDir = resolve('qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots');
const now = new Date().toISOString();

mkdirSync(outDir, { recursive: true });

const users = {
  admin: {
    id: 'qa-admin',
    username: 'qa_admin',
    displayName: 'QA Admin',
    roles: ['admin'],
    permissions: []
  },
  operation: {
    id: 'qa-operation',
    username: 'qa_operation',
    displayName: 'QA Operation',
    roles: ['operation'],
    permissions: ['code.order.view']
  },
  auditor: {
    id: 'qa-auditor',
    username: 'qa_auditor',
    displayName: 'QA Auditor',
    roles: ['auditor'],
    permissions: ['audit_log.view']
  }
};

function pageResult(items = [], pageSize = 20) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize
  };
}

function apiResponse(data, success = true, message = '') {
  return {
    success,
    message,
    data
  };
}

function roleItems() {
  return [
    {
      id: 'role-admin',
      code: 'admin',
      name: '超级管理员',
      description: 'QA',
      rolePermissions: [],
      _count: { userRoles: 1 }
    },
    {
      id: 'role-operation',
      code: 'operation',
      name: '业务员工',
      description: 'QA',
      rolePermissions: [],
      _count: { userRoles: 1 }
    }
  ];
}

function sourcePlatformItems() {
  return [
    {
      id: 'platform-qa',
      name: 'QA 平台',
      feeRate: '0',
      feeFixed: '0',
      status: 'active',
      remark: '',
      createdAt: now,
      updatedAt: now
    }
  ];
}

function dashboardSafePage() {
  return pageResult([], 20);
}

function responseFor(path, user) {
  if (path === '/auth/me') return user;
  if (path === '/maintenance/mode/public') return { enabled: false, allowedRoles: ['admin'] };
  if (path === '/notifications/nav-badges' || path === '/notifications/nav-item-badges') return {};
  if (path === '/notifications/overview') {
    return {
      enabledRuleCount: 0,
      unreadCount: 0,
      failedLogCount: 0,
      telegramCount: 0,
      recentLogs: []
    };
  }
  if (path.startsWith('/notifications')) return pageResult([], 20);
  if (path === '/roles') return roleItems();
  if (path === '/permissions') return [];
  if (path === '/users') return pageResult([], 20);
  if (path === '/user-table-views') return pageResult([], 100);
  if (path === '/source-platforms') return pageResult(sourcePlatformItems(), 100);
  if (path === '/customers') return pageResult([], 100);
  if (path === '/apple/accounts') return dashboardSafePage();
  if (path === '/apple/orders') return dashboardSafePage();
  if (path === '/apple/renewal-tasks') return dashboardSafePage();
  if (path === '/apple/services/order-options') return { items: [] };
  if (path === '/codes/orders') return dashboardSafePage();
  if (path === '/codes/services/order-options') return { items: [] };
  if (path === '/codes/inventory') return dashboardSafePage();
  if (path.startsWith('/audit-logs')) return pageResult([], 20);
  if (path === '/data/dictionaries') return pageResult([], 200);

  return pageResult([], 20);
}

async function createPage(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 390, height: 844 },
    deviceScaleFactor: 1
  });

  if (options.user) {
    await context.addInitScript((user) => {
      globalThis.localStorage.setItem('apple_business_access_token', 'qa-token');
      globalThis.localStorage.setItem('apple_business_current_user', JSON.stringify(user));
    }, options.user);
  }

  let navBadgeExpired = false;

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (!url.pathname.startsWith('/api/')) {
      await route.fallback();
      return;
    }

    const path = url.pathname.replace(/^\/api/, '') || '/';

    if (path.includes('/realtime')) {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
      return;
    }

    if (path === '/auth/login' && request.method() === 'POST') {
      if (options.loginOutcome === 'mfaRequired') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify(apiResponse(null, false, 'MFA code is required'))
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiResponse({
            accessToken: 'qa-token',
            user: options.loginUser ?? users.admin
          })
        )
      });
      return;
    }

    if (options.expireOnNavBadges && path === '/notifications/nav-badges' && !navBadgeExpired) {
      navBadgeExpired = true;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse(null, false, 'Invalid or expired token'))
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiResponse(responseFor(path, options.user ?? options.loginUser ?? users.admin))
      )
    });
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  return { context, page, consoleErrors };
}

async function fillAndSubmitLogin(page) {
  await page.locator('input[name="username"]').fill('qa_admin');
  await page.locator('input[name="password"]').fill('password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

async function screenshot(page, name) {
  const screenshotPath = resolve(outDir, name);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

function result(ok, state, screenshotPath, consoleErrors = []) {
  return { ok, state, screenshotPath, consoleErrors };
}

function hasBlockingConsoleErrors(consoleErrors) {
  return consoleErrors.some(
    (message) =>
      !message.includes('400 (Bad Request)') &&
      !message.includes('401 (Unauthorized)') &&
      !message.includes('ERR_ABORTED')
  );
}

async function runScenario(browser, name, fn) {
  try {
    return await fn();
  } catch (error) {
    return {
      ok: false,
      state: {
        error: error instanceof Error ? error.message : String(error)
      },
      screenshotPath: null,
      consoleErrors: [],
      name
    };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  try {
    results.guestRedirect = await runScenario(browser, 'guestRedirect', async () => {
      const { context, page, consoleErrors } = await createPage(browser);
      await page.goto(`${baseUrl}/codes/orders`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.login-page', { timeout: 15000 });
      const state = {
        url: page.url(),
        hasLogin: await page.locator('.login-page').count(),
        redirect: new URL(page.url()).searchParams.get('redirect')
      };
      const screenshotPath = await screenshot(page, '16-auth-guest-redirect.png');
      await context.close();
      return result(
        state.url.includes('/login') && state.redirect === '/codes/orders',
        state,
        screenshotPath,
        consoleErrors
      );
    });

    results.mfaLoginError = await runScenario(browser, 'mfaLoginError', async () => {
      const { context, page, consoleErrors } = await createPage(browser, {
        loginOutcome: 'mfaRequired'
      });
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
      await fillAndSubmitLogin(page);
      await page.waitForSelector('#login-error-message', { timeout: 15000 });
      const errorText = (await page.locator('#login-error-message').innerText()).trim();
      const state = {
        url: page.url(),
        errorText
      };
      const screenshotPath = await screenshot(page, '17-auth-login-mfa-error.png');
      await context.close();
      return result(
        state.url.endsWith('/login') && errorText.includes('动态验证码'),
        state,
        screenshotPath,
        consoleErrors
      );
    });

    results.unsafeRedirectLogin = await runScenario(browser, 'unsafeRedirectLogin', async () => {
      const { context, page, consoleErrors } = await createPage(browser, {
        loginUser: users.admin
      });
      await page.goto(`${baseUrl}/login?redirect=//evil.example`, {
        waitUntil: 'domcontentloaded'
      });
      await fillAndSubmitLogin(page);
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      const state = {
        url: page.url(),
        stayedOnOrigin: new URL(page.url()).origin === baseUrl
      };
      const screenshotPath = await screenshot(page, '18-auth-login-unsafe-redirect.png');
      await context.close();
      return result(
        state.url.endsWith('/dashboard') && state.stayedOnOrigin,
        state,
        screenshotPath,
        consoleErrors
      );
    });

    results.operationRole = await runScenario(browser, 'operationRole', async () => {
      const { context, page, consoleErrors } = await createPage(browser, {
        user: users.operation
      });
      await page.goto(`${baseUrl}/codes/orders`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.table-toolbar', { timeout: 15000 });
      const allowedText = await page.locator('body').innerText();
      const createButtonCount = await page
        .getByRole('button', { name: '手工导入订单', exact: true })
        .count();
      await page.goto(`${baseUrl}/system/users`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL('**/403', { timeout: 15000 });
      const forbiddenText = await page.locator('body').innerText();
      const state = {
        allowedUrl: `${baseUrl}/codes/orders`,
        finalUrl: page.url(),
        createButtonCount,
        hidesCreateButton: createButtonCount === 0,
        hidesStaffSection: !allowedText.includes('员工与权限'),
        forbiddenText: forbiddenText.slice(0, 160)
      };
      const screenshotPath = await screenshot(page, '19-role-operation-403.png');
      await context.close();
      return result(
        state.finalUrl.endsWith('/403') &&
          state.hidesCreateButton &&
          state.hidesStaffSection &&
          forbiddenText.includes('无权限'),
        state,
        screenshotPath,
        consoleErrors
      );
    });

    results.auditorRole = await runScenario(browser, 'auditorRole', async () => {
      const { context, page, consoleErrors } = await createPage(browser, {
        user: users.auditor
      });
      await page.goto(`${baseUrl}/system/audit-logs`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.audit-log-tabs', { timeout: 15000 });
      const auditText = await page.locator('body').innerText();
      const auditScreenshotPath = await screenshot(page, '20-role-auditor-audit-log.png');
      await page.goto(`${baseUrl}/system/users`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL('**/403', { timeout: 15000 });
      const forbiddenText = await page.locator('body').innerText();
      await context.close();
      return result(
        auditText.includes('审计日志') &&
          page.url().endsWith('/403') &&
          forbiddenText.includes('无权限'),
        {
          auditAllowed: auditText.includes('审计日志'),
          finalUrl: page.url(),
          forbiddenText: forbiddenText.slice(0, 160)
        },
        auditScreenshotPath,
        consoleErrors
      );
    });

    results.sessionExpired = await runScenario(browser, 'sessionExpired', async () => {
      const { context, page, consoleErrors } = await createPage(browser, {
        user: users.admin,
        expireOnNavBadges: true,
        viewport: { width: 1024, height: 768 }
      });
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL('**/login?redirect=/dashboard', { timeout: 15000 });
      const state = {
        url: page.url(),
        redirect: new URL(page.url()).searchParams.get('redirect'),
        hasLogin: await page.locator('.login-page').count()
      };
      const screenshotPath = await screenshot(page, '21-auth-session-expired-redirect.png');
      await context.close();
      return result(
        state.url.includes('/login') && state.redirect === '/dashboard' && state.hasLogin === 1,
        state,
        screenshotPath,
        consoleErrors
      );
    });
  } finally {
    await browser.close();
  }

  for (const [name, scenario] of Object.entries(results)) {
    if (!scenario.ok) {
      console.error(`${name} failed`);
      console.error(JSON.stringify(scenario, null, 2));
    }
  }

  const ok = Object.values(results).every(
    (scenario) => scenario.ok && !hasBlockingConsoleErrors(scenario.consoleErrors)
  );

  console.log(JSON.stringify({ ok, baseUrl, results }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Admin auth role probe failed');
  process.exitCode = 1;
});
