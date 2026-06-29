#!/usr/bin/env node

import crypto from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BALANCE_URL = 'https://secure.store.apple.com/shop/giftcard/balance';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_SESSION_DIR = '.runtime/apple-gift-card-balance-sessions';
const SESSION_LOCK_RETRY_MS = 500;

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('error', reject);
    process.stdin.on('end', () => resolve(input));
  });
}

function getTimeoutMs() {
  const value = Number(process.env.APPLE_GIFT_CARD_BALANCE_QUERY_TIMEOUT_MS);
  return Number.isInteger(value) && value >= 5_000 && value <= 600_000 ? value : DEFAULT_TIMEOUT_MS;
}

function getProxy() {
  const server =
    process.env.APPLE_GIFT_CARD_BALANCE_QUERY_PROXY_SERVER ||
    process.env.APPLE_WEB_CHECK_PROXY_SERVER ||
    '';
  return server ? { server } : undefined;
}

function getBalanceUrl() {
  return process.env.APPLE_GIFT_CARD_BALANCE_QUERY_URL || DEFAULT_BALANCE_URL;
}

function getSessionRoot() {
  return process.env.APPLE_GIFT_CARD_BALANCE_QUERY_SESSION_DIR || DEFAULT_SESSION_DIR;
}

function getAccountSessionKey(account) {
  const stableKey = String(account.id || account.appleId || 'default');
  return crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 32);
}

function getSessionDirForAccount(account) {
  const digest = getAccountSessionKey(account);
  return path.resolve(process.cwd(), getSessionRoot(), digest);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSessionLockTimeoutMs() {
  return Math.min(Math.max(getTimeoutMs(), 30_000), 600_000);
}

function getSessionLockStaleMs() {
  return Math.max(getSessionLockTimeoutMs() * 4, 30 * 60_000);
}

async function acquireSessionLock(userDataDir) {
  const lockDir = `${userDataDir}.lock`;
  const deadline = Date.now() + getSessionLockTimeoutMs();

  for (;;) {
    try {
      await mkdir(lockDir, { recursive: false, mode: 0o700 });
      await writeFile(
        path.join(lockDir, 'owner.json'),
        JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })
      ).catch(() => undefined);
      return () => rm(lockDir, { recursive: true, force: true }).catch(() => undefined);
    } catch (error) {
      if (!error || typeof error !== 'object' || error.code !== 'EEXIST') {
        throw error;
      }

      const lockStat = await stat(lockDir).catch(() => null);
      if (lockStat && Date.now() - lockStat.mtimeMs > getSessionLockStaleMs()) {
        await rm(lockDir, { recursive: true, force: true }).catch(() => undefined);
        continue;
      }

      if (Date.now() >= deadline) {
        const timeout = new Error('查询账号登录态正在被另一个批次使用，请稍后重试');
        timeout.code = 'SESSION_LOCK_TIMEOUT';
        throw timeout;
      }

      await sleep(SESSION_LOCK_RETRY_MS);
    }
  }
}

async function createPersistentContext(chromium, account) {
  const userDataDir = getSessionDirForAccount(account);
  await mkdir(userDataDir, { recursive: true, mode: 0o700 });
  const releaseLock = await acquireSessionLock(userDataDir);

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.APPLE_GIFT_CARD_BALANCE_QUERY_HEADLESS !== 'false',
      proxy: getProxy(),
      locale: process.env.APPLE_GIFT_CARD_BALANCE_QUERY_LOCALE || 'en-US',
      timezoneId: process.env.APPLE_GIFT_CARD_BALANCE_QUERY_TIMEZONE || 'America/Los_Angeles'
    });
    return { context, releaseLock };
  } catch (error) {
    await releaseLock();
    throw error;
  }
}

function normalizeInput(value) {
  if (!value || typeof value !== 'object') return { accounts: [], rows: [] };
  return {
    runId: typeof value.runId === 'string' ? value.runId : '',
    accounts: Array.isArray(value.accounts) ? value.accounts : [],
    rows: Array.isArray(value.rows) ? value.rows : []
  };
}

function accountForRow(payload, row) {
  return (
    payload.accounts.find((account) => account.id === row.assignedAccountId) ||
    payload.accounts[0] ||
    null
  );
}

function groupRowsByAccount(payload) {
  const groups = new Map();
  const missingAccountRows = [];

  for (const row of payload.rows) {
    const account = accountForRow(payload, row);
    if (!account?.appleId || !account.password) {
      missingAccountRows.push(row);
      continue;
    }

    const key = getAccountSessionKey(account);
    const group = groups.get(key) || { account, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return {
    groups: Array.from(groups.values()),
    missingAccountRows
  };
}

function missingAccountResult(row) {
  return {
    rowId: row.id,
    status: 'manual_required',
    balance: '-',
    currency: '-',
    message: '该礼品卡没有可用查询账号'
  };
}

function failedQueryResult(row, message = '礼品卡余额查询浏览器执行失败') {
  return {
    rowId: row.id,
    status: 'failed',
    balance: '-',
    currency: '-',
    message
  };
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click().catch(() => undefined);
      return true;
    }
  }
  return false;
}

async function clickButtonByText(page, pattern) {
  const button = page.getByRole('button', { name: pattern }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click().catch(() => undefined);
    return true;
  }
  return false;
}

async function pageText(page) {
  return ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
}

function isManualChallengeText(text) {
  return /验证码|验证|安全|captcha|verification code|two-factor|two factor|trusted device|security code/i.test(
    text
  );
}

function isPasswordErrorText(text) {
  return /密码错误|incorrect password|password is incorrect|apple id or password/i.test(text);
}

async function trySignIn(page, account) {
  const accountInput = await firstVisible(page, [
    'input[type="email"]',
    'input[name="accountName"]',
    '#account_name_text_field',
    'input[id*="account"]',
    'input[name*="account"]'
  ]);
  if (!accountInput) return { ok: true };

  await accountInput.fill(account.appleId);
  await clickButtonByText(page, /continue|next|sign in|登录|继续/i);
  await clickFirst(page, ['button[type="submit"]', '#sign-in']);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const passwordInput = await firstVisible(page, [
    'input[type="password"]',
    'input[name="password"]',
    '#password_text_field'
  ]);
  if (!passwordInput) {
    const text = await pageText(page);
    return isManualChallengeText(text)
      ? { ok: false, manual: true, message: 'Apple 要求人工验证后才能查询礼品卡余额' }
      : { ok: false, message: 'Apple 登录页密码输入框无法识别' };
  }

  await passwordInput.fill(account.password);
  await clickButtonByText(page, /sign in|continue|next|登录|继续/i);
  await clickFirst(page, ['button[type="submit"]', '#sign-in']);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const text = await pageText(page);
  if (isPasswordErrorText(text)) {
    return { ok: false, message: 'Apple ID 或密码错误，无法查询礼品卡余额' };
  }
  if (isManualChallengeText(text)) {
    return { ok: false, manual: true, message: 'Apple 要求验证码、设备确认或 CAPTCHA' };
  }

  return { ok: true };
}

async function fillGiftCardCode(page, code) {
  const customSelector = process.env.APPLE_GIFT_CARD_BALANCE_QUERY_CODE_SELECTOR;
  const input = await firstVisible(page, [
    ...(customSelector ? [customSelector] : []),
    'input[name*="gift"]',
    'input[id*="gift"]',
    'input[name*="card"]',
    'input[id*="card"]',
    'input[name*="pin"]',
    'input[id*="pin"]',
    'input[type="text"]'
  ]);
  if (!input) return false;
  await input.fill(code);
  return true;
}

async function submitBalanceForm(page) {
  const customSelector = process.env.APPLE_GIFT_CARD_BALANCE_QUERY_SUBMIT_SELECTOR;
  if (customSelector && (await clickFirst(page, [customSelector]))) return true;
  if (
    await clickButtonByText(
      page,
      /check balance|view balance|balance|submit|continue|查询|查看余额|继续/i
    )
  ) {
    return true;
  }
  return clickFirst(page, ['button[type="submit"]', 'input[type="submit"]']);
}

function parseBalance(text) {
  const currencyCodes = 'USD|MYR|SGD|HKD|JPY|GBP|EUR|AUD|CAD|CNY|TWD|THB|PHP|IDR|VND';
  const symbolMatch = text.match(/(?:US\$|HK\$|S\$|RM|\$|£|€|¥)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
  const codeBeforeMatch = text.match(
    new RegExp(`\\b(${currencyCodes})\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\b`, 'i')
  );
  const codeAfterMatch = text.match(
    new RegExp(`\\b([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(${currencyCodes})\\b`, 'i')
  );

  if (codeBeforeMatch) {
    return {
      balance: codeBeforeMatch[2].replace(/,/g, ''),
      currency: codeBeforeMatch[1].toUpperCase()
    };
  }
  if (codeAfterMatch) {
    return {
      balance: codeAfterMatch[1].replace(/,/g, ''),
      currency: codeAfterMatch[2].toUpperCase()
    };
  }
  if (symbolMatch) {
    return {
      balance: symbolMatch[1].replace(/,/g, ''),
      currency: text.includes('HK$') ? 'HKD' : text.includes('S$') ? 'SGD' : '-'
    };
  }

  return null;
}

async function queryRowWithContext(context, account, row) {
  const page = await context.newPage();
  page.setDefaultTimeout(getTimeoutMs());

  try {
    await page.goto(getBalanceUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const signIn = await trySignIn(page, account);
    if (!signIn.ok) {
      return {
        rowId: row.id,
        status: signIn.manual ? 'manual_required' : 'failed',
        balance: '-',
        currency: '-',
        message: signIn.message
      };
    }

    if (!(await fillGiftCardCode(page, row.giftCardCode))) {
      return {
        rowId: row.id,
        status: 'manual_required',
        balance: '-',
        currency: '-',
        message: '礼品卡代码输入框无法识别，需要更新执行器选择器'
      };
    }

    await submitBalanceForm(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(800).catch(() => undefined);

    const text = await pageText(page);
    if (isManualChallengeText(text)) {
      return {
        rowId: row.id,
        status: 'manual_required',
        balance: '-',
        currency: '-',
        message: 'Apple 要求人工验证后才能完成礼品卡余额查询'
      };
    }

    const balance = parseBalance(text);
    if (!balance) {
      return {
        rowId: row.id,
        status: 'manual_required',
        balance: '-',
        currency: '-',
        message: '页面未稳定返回余额，需要人工确认或更新执行器选择器'
      };
    }

    return {
      rowId: row.id,
      status: 'success',
      balance: balance.balance,
      currency: balance.currency,
      message: '礼品卡余额查询成功'
    };
  } catch {
    return failedQueryResult(row);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function queryRowsForAccount(chromium, account, rows) {
  let releaseLock = null;
  let context = null;

  try {
    const session = await createPersistentContext(chromium, account);
    context = session.context;
    releaseLock = session.releaseLock;

    const results = [];
    for (const row of rows) {
      results.push(await queryRowWithContext(context, account, row));
    }
    return results;
  } catch (error) {
    const message =
      error && typeof error === 'object' && error.code === 'SESSION_LOCK_TIMEOUT'
        ? error.message
        : '礼品卡余额查询浏览器执行失败';
    return rows.map((row) => failedQueryResult(row, message));
  } finally {
    if (context) {
      await context.close().catch(() => undefined);
    }
    if (releaseLock) {
      await releaseLock();
    }
  }
}

async function main() {
  const input = normalizeInput(JSON.parse(await readStdin()));
  if (!input.rows.length) {
    process.stdout.write(JSON.stringify({ rows: [] }));
    return;
  }

  const { chromium } = await import('playwright');
  const { groups, missingAccountRows } = groupRowsByAccount(input);
  const resultByRowId = new Map();

  for (const row of missingAccountRows) {
    resultByRowId.set(row.id, missingAccountResult(row));
  }

  for (const group of groups) {
    const results = await queryRowsForAccount(chromium, group.account, group.rows);
    for (const result of results) {
      resultByRowId.set(result.rowId, result);
    }
  }

  const rows = input.rows.map(
    (row) => resultByRowId.get(row.id) || failedQueryResult(row, '礼品卡余额查询未返回结果')
  );

  process.stdout.write(JSON.stringify({ rows }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ rows: [] }));
  process.exitCode = 1;
});
