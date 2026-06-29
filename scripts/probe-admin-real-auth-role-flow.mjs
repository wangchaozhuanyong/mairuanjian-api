#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const scrypt = promisify(scryptCallback);
const adminBaseUrl = process.env.ADMIN_UI_BASE_URL ?? 'http://127.0.0.1:5374';
const realApiBaseUrl = process.env.REAL_API_BASE_URL ?? 'http://127.0.0.1:18081/api';
const proxyPort = Number(process.env.ADMIN_UI_REAL_API_PROXY_PORT ?? 3000);
const apiContainer = process.env.ADMIN_UI_REAL_API_CONTAINER ?? 'apple-business-prod-api-1';
const outDir = resolve('qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots');
const suffix = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;

mkdirSync(outDir, { recursive: true });

function apiUrl(path) {
  return `${realApiBaseUrl.replace(/\/$/, '')}${path}`;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

function runDockerNode(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('docker', ['exec', '-i', apiContainer, 'node', '-'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `docker exec exited with ${code}`));
        return;
      }

      resolvePromise(stdout.trim());
    });

    child.stdin.end(script);
  });
}

async function setupProbeUsers() {
  const operationPassword = randomBytes(18).toString('base64url');
  const auditorPassword = randomBytes(18).toString('base64url');
  const adminPassword = randomBytes(18).toString('base64url');
  const mfaAdminPassword = randomBytes(18).toString('base64url');
  const payload = {
    suffix,
    operation: {
      username: `uiux_probe_operation_${suffix}`,
      displayName: 'UIUX Probe Operation',
      passwordHash: await hashPassword(operationPassword)
    },
    auditor: {
      username: `uiux_probe_auditor_${suffix}`,
      displayName: 'UIUX Probe Auditor',
      passwordHash: await hashPassword(auditorPassword)
    },
    admin: {
      username: `uiux_probe_admin_${suffix}`,
      displayName: 'UIUX Probe Admin',
      passwordHash: await hashPassword(adminPassword)
    },
    mfaAdmin: {
      username: `uiux_probe_mfa_admin_${suffix}`,
      displayName: 'UIUX Probe MFA Admin',
      passwordHash: await hashPassword(mfaAdminPassword)
    }
  };

  const output = await runDockerNode(`
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const payload = ${JSON.stringify(payload)};
const rolePermissionTargets = [
  ['operation', 'code.order.view'],
  ['operation', 'notification.view'],
  ['auditor', 'audit_log.view'],
  ['auditor', 'notification.view']
];

async function cleanupStaleProbeUsers() {
  const staleUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'uiux_probe_' } },
    select: { id: true }
  });
  const userIds = staleUsers.map((user) => user.id);

  if (!userIds.length) return;

  await prisma.activeSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.loginLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userTableView.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.securitySetting.deleteMany({
    where: {
      key: { in: userIds.map((userId) => \`mfa_user_\${userId}\`) }
    }
  });
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function roleByCode(code) {
  const role = await prisma.role.findUnique({
    where: { code },
    include: { _count: { select: { userRoles: true } } }
  });

  if (!role) throw new Error(\`Missing role \${code}\`);
  if (role._count.userRoles > 0) {
    throw new Error(\`Role \${code} already has users; refusing to mutate shared role permissions\`);
  }

  return role;
}

async function findRoleByCode(code) {
  const role = await prisma.role.findUnique({ where: { code } });
  if (!role) throw new Error(\`Missing role \${code}\`);
  return role;
}

async function ensureRolePermission(role, permissionCode) {
  const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
  if (!permission) return null;

  const existing = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }
  });

  if (existing) {
    return { roleId: role.id, permissionId: permission.id, created: false };
  }

  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: permission.id }
  });

  return { roleId: role.id, permissionId: permission.id, created: true };
}

async function createUser(userPayload, roleId) {
  const user = await prisma.user.create({
    data: {
      username: userPayload.username,
      passwordHash: userPayload.passwordHash,
      displayName: userPayload.displayName,
      status: 'active'
    },
    select: { id: true, username: true }
  });

  await prisma.userRole.create({ data: { userId: user.id, roleId } });
  return user;
}

(async () => {
  await cleanupStaleProbeUsers();
  const adminRole = await findRoleByCode('admin');
  const operationRole = await roleByCode('operation');
  const auditorRole = await roleByCode('auditor');
  const createdRolePermissions = [];

  for (const [roleCode, permissionCode] of rolePermissionTargets) {
    const role = roleCode === 'operation' ? operationRole : auditorRole;
    const result = await ensureRolePermission(role, permissionCode);
    if (result?.created) createdRolePermissions.push(result);
  }

  const adminUser = await createUser(payload.admin, adminRole.id);
  const mfaAdminUser = await createUser(payload.mfaAdmin, adminRole.id);
  const operationUser = await createUser(payload.operation, operationRole.id);
  const auditorUser = await createUser(payload.auditor, auditorRole.id);

  console.log(JSON.stringify({
    adminUser,
    mfaAdminUser,
    operationUser,
    auditorUser,
    createdRolePermissions
  }));
})()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
`);

  const setup = JSON.parse(output);

  return {
    ...setup,
    credentials: {
      operation: {
        username: payload.operation.username,
        password: operationPassword
      },
      auditor: {
        username: payload.auditor.username,
        password: auditorPassword
      },
      admin: {
        username: payload.admin.username,
        password: adminPassword
      },
      mfaAdmin: {
        username: payload.mfaAdmin.username,
        password: mfaAdminPassword
      }
    }
  };
}

async function cleanupProbeUsers(setup) {
  if (!setup) return;

  const payload = {
    userIds: [
      setup.adminUser?.id,
      setup.mfaAdminUser?.id,
      setup.operationUser?.id,
      setup.auditorUser?.id
    ].filter(Boolean),
    createdRolePermissions: setup.createdRolePermissions ?? []
  };

  await runDockerNode(`
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const payload = ${JSON.stringify(payload)};

(async () => {
  if (payload.userIds.length) {
    await prisma.activeSession.deleteMany({ where: { userId: { in: payload.userIds } } });
    await prisma.loginLog.deleteMany({ where: { userId: { in: payload.userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: payload.userIds } } });
    await prisma.userTableView.deleteMany({ where: { userId: { in: payload.userIds } } });
    await prisma.securitySetting.deleteMany({
      where: {
        key: { in: payload.userIds.map((userId) => \`mfa_user_\${userId}\`) }
      }
    });
    await prisma.userRole.deleteMany({ where: { userId: { in: payload.userIds } } });
    await prisma.user.deleteMany({
      where: {
        id: { in: payload.userIds },
        username: { startsWith: 'uiux_probe_' }
      }
    });
  }

  for (const rolePermission of payload.createdRolePermissions) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: rolePermission.roleId,
        permissionId: rolePermission.permissionId
      }
    });
  }

  console.log(JSON.stringify({ cleaned: true }));
})()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
`);
}

function startRealApiProxy() {
  const targetOrigin = new URL(realApiBaseUrl).origin;

  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }

      const headers = { ...request.headers };
      delete headers.host;

      const targetUrl = new URL(request.url ?? '/', targetOrigin);
      const upstream = await fetch(targetUrl, {
        body: chunks.length ? Buffer.concat(chunks) : undefined,
        headers,
        method: request.method,
        redirect: 'manual'
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      const responseHeaders = Object.fromEntries(upstream.headers);
      delete responseHeaders['content-encoding'];
      delete responseHeaders['content-length'];
      delete responseHeaders['transfer-encoding'];

      response.writeHead(upstream.status, responseHeaders);
      response.end(body);
    } catch (error) {
      response.statusCode = 502;
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(proxyPort, () => {
      server.off('error', reject);
      resolvePromise(server);
    });
  });
}

async function closeServer(server) {
  if (!server) return;
  server.closeIdleConnections?.();
  server.closeAllConnections?.();

  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      server.closeAllConnections?.();
      resolvePromise();
    }, 1500);

    server.close((error) => {
      clearTimeout(timeout);
      if (error) reject(error);
      else resolvePromise();
    });
  });
}

async function unwrapApi(response, label) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(`${label} failed: ${response.status} ${body?.message ?? 'unknown'}`);
  }

  return body?.data ?? body;
}

async function apiRequest(path, token) {
  const response = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  const body = await response.json().catch(() => null);

  return {
    body,
    ok: response.ok && body?.success !== false,
    status: response.status
  };
}

async function apiPost(path, body, token) {
  return unwrapApi(
    await fetch(apiUrl(path), {
      body: JSON.stringify(body ?? {}),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      method: 'POST'
    }),
    path
  );
}

async function fillLogin(page, username, password) {
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

async function fillLoginWithMfa(page, username, password, mfaCode) {
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="one-time-code"]').fill(mfaCode);
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

function generateTotp(secret, counterOffset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let buffer = 0;
  const bytes = [];

  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('invalid base32 secret');
    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

async function screenshot(page, name) {
  const path = resolve(outDir, name);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function waitForTransientMessages(page) {
  await page
    .locator('.el-message')
    .first()
    .waitFor({ state: 'detached', timeout: 4000 })
    .catch(() => undefined);
}

function createResult(ok, state, screenshotPath, consoleErrors = []) {
  return { ok, state, screenshotPath, consoleErrors };
}

function wait(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function collectConsoleErrors(page) {
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  return consoleErrors;
}

function hasBlockingConsoleErrors(consoleErrors) {
  return consoleErrors.some(
    (message) =>
      !message.includes('400 (Bad Request)') &&
      !message.includes('401 (Unauthorized)') &&
      !message.includes('403 (Forbidden)') &&
      !message.includes('ERR_ABORTED')
  );
}

async function runScenario(name, fn) {
  try {
    return await fn();
  } catch (error) {
    return {
      ok: false,
      state: { error: error instanceof Error ? error.message : String(error) },
      screenshotPath: null,
      consoleErrors: [],
      name
    };
  }
}

async function getStoredToken(page) {
  return page.evaluate(() => globalThis.localStorage.getItem('apple_business_access_token'));
}

async function main() {
  let proxyServer = null;
  let setup = null;
  const results = {};
  const health = await unwrapApi(await fetch(apiUrl('/health/ready')), 'health');

  try {
    setup = await setupProbeUsers();
    proxyServer = await startRealApiProxy();

    const browser = await chromium.launch({ headless: true });

    try {
      results.invalidPassword = await runScenario('invalidPassword', async () => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const consoleErrors = collectConsoleErrors(page);

        await page.goto(`${adminBaseUrl}/login`);
        await fillLogin(page, setup.credentials.operation.username, 'wrong-password');
        const alert = page.locator('.login-error[role="alert"]').filter({
          hasText: '账号或密码错误'
        });
        await alert.waitFor({ state: 'visible', timeout: 8000 });
        const screenshotPath = await screenshot(page, '22-real-login-invalid-password.png');
        const state = {
          url: page.url(),
          alertText: (await alert.textContent())?.trim() ?? ''
        };

        await context.close();
        return createResult(
          state.alertText.includes('账号或密码错误'),
          state,
          screenshotPath,
          consoleErrors
        );
      });

      results.adminRole = await runScenario('adminRole', async () => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const consoleErrors = collectConsoleErrors(page);

        await page.goto(`${adminBaseUrl}/login?redirect=/system/users`);
        await fillLogin(page, setup.credentials.admin.username, setup.credentials.admin.password);
        await page.waitForURL('**/system/users', { timeout: 15000 });
        await page.getByText('员工账号列表').first().waitFor({ timeout: 10000 });
        await waitForTransientMessages(page);
        const token = await getStoredToken(page);
        const usersApi = await apiRequest('/users?page=1&pageSize=1', token);
        const rolesApi = await apiRequest('/roles', token);
        const screenshotPath = await screenshot(page, '27-real-admin-users.png');
        const state = {
          apiUsersStatus: usersApi.status,
          apiRolesStatus: rolesApi.status,
          url: page.url()
        };

        await context.close();
        return createResult(
          usersApi.ok && rolesApi.ok && state.url.includes('/system/users'),
          state,
          screenshotPath,
          consoleErrors
        );
      });

      results.realMfa = await runScenario('realMfa', async () => {
        const loginData = await apiPost('/auth/login', {
          username: setup.credentials.mfaAdmin.username,
          password: setup.credentials.mfaAdmin.password
        });
        const mfaSetup = await apiPost('/security/mfa/me/setup', {}, loginData.accessToken);
        await apiPost(
          '/security/mfa/me/enable',
          { code: generateTotp(mfaSetup.secret) },
          loginData.accessToken
        );
        const nextTotpCode = generateTotp(mfaSetup.secret, 1);
        await wait(1100);

        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const consoleErrors = collectConsoleErrors(page);

        await page.goto(`${adminBaseUrl}/login?redirect=/dashboard`);
        await fillLogin(
          page,
          setup.credentials.mfaAdmin.username,
          setup.credentials.mfaAdmin.password
        );
        const alert = page.locator('.login-error[role="alert"]').filter({
          hasText: '需要输入动态验证码或恢复码'
        });
        await alert.waitFor({ state: 'visible', timeout: 8000 });
        const requiredAlertText = (await alert.textContent())?.trim() ?? '';
        const requiredScreenshotPath = await screenshot(page, '28-real-mfa-required.png');

        await fillLoginWithMfa(
          page,
          setup.credentials.mfaAdmin.username,
          setup.credentials.mfaAdmin.password,
          nextTotpCode
        );
        await page.waitForURL('**/dashboard', { timeout: 15000 });
        await waitForTransientMessages(page);
        const successScreenshotPath = await screenshot(page, '29-real-mfa-totp-login.png');
        const state = {
          requiredAlertText,
          requiredScreenshotPath,
          successScreenshotPath,
          hasStoredToken: await page.evaluate(() =>
            Boolean(globalThis.localStorage.getItem('apple_business_access_token'))
          ),
          url: page.url()
        };

        await context.close();
        return createResult(
          state.requiredAlertText.includes('需要输入动态验证码或恢复码') &&
            state.url.includes('/dashboard') &&
            state.hasStoredToken,
          state,
          successScreenshotPath,
          consoleErrors
        );
      });

      results.operationRole = await runScenario('operationRole', async () => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const consoleErrors = collectConsoleErrors(page);

        await page.goto(`${adminBaseUrl}/login?redirect=/codes/orders`);
        await fillLogin(
          page,
          setup.credentials.operation.username,
          setup.credentials.operation.password
        );
        await page.waitForURL('**/codes/orders', { timeout: 15000 });
        await page
          .getByRole('heading', { name: /兑换码订单/ })
          .first()
          .waitFor({ timeout: 10000 });
        const token = await getStoredToken(page);
        const codeOrdersApi = await apiRequest('/codes/orders?page=1&pageSize=1', token);
        const usersApi = await apiRequest('/users?page=1&pageSize=1', token);
        const createButtonCount = await page
          .getByRole('button', { name: '手工导入订单', exact: true })
          .count();
        await waitForTransientMessages(page);
        const screenshotPath = await screenshot(page, '23-real-operation-code-orders.png');

        await page.goto(`${adminBaseUrl}/system/users`);
        await page.waitForURL('**/403', { timeout: 10000 });
        const forbiddenText = (await page.locator('body').textContent()) ?? '';
        const state = {
          apiCodeOrdersStatus: codeOrdersApi.status,
          apiUsersStatus: usersApi.status,
          createButtonCount,
          finalUrl: page.url(),
          forbiddenVisible: forbiddenText.includes('403 无权限')
        };

        await context.close();
        return createResult(
          codeOrdersApi.ok &&
            usersApi.status === 403 &&
            createButtonCount === 0 &&
            state.forbiddenVisible,
          state,
          screenshotPath,
          consoleErrors
        );
      });

      results.auditorRole = await runScenario('auditorRole', async () => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const consoleErrors = collectConsoleErrors(page);

        await page.goto(`${adminBaseUrl}/login?redirect=/system/audit-logs`);
        await fillLogin(
          page,
          setup.credentials.auditor.username,
          setup.credentials.auditor.password
        );
        await page.waitForURL('**/system/audit-logs', { timeout: 15000 });
        await page
          .getByRole('heading', { name: /审计日志中心/ })
          .first()
          .waitFor({ timeout: 10000 });
        await page.getByText('审计日志工作台').first().waitFor({ timeout: 10000 });
        const token = await getStoredToken(page);
        const auditApi = await apiRequest('/audit-logs?page=1&pageSize=1', token);
        const usersApi = await apiRequest('/users?page=1&pageSize=1', token);
        const auditScreenshotPath = await screenshot(page, '24-real-auditor-audit-logs.png');

        await page.goto(`${adminBaseUrl}/system/users`);
        await page.waitForURL('**/403', { timeout: 10000 });
        const forbiddenText = (await page.locator('body').textContent()) ?? '';
        const forbiddenScreenshotPath = await screenshot(page, '25-real-auditor-users-403.png');
        const state = {
          apiAuditStatus: auditApi.status,
          apiUsersStatus: usersApi.status,
          finalUrl: page.url(),
          forbiddenVisible: forbiddenText.includes('403 无权限'),
          forbiddenScreenshotPath
        };

        await context.close();
        return createResult(
          auditApi.ok && usersApi.status === 403 && state.forbiddenVisible,
          state,
          auditScreenshotPath,
          consoleErrors
        );
      });

      results.sessionExpired = await runScenario('sessionExpired', async () => {
        const context = await browser.newContext({
          viewport: { width: 1024, height: 768 }
        });
        await context.addInitScript(
          (user) => {
            globalThis.localStorage.setItem('apple_business_access_token', 'invalid-token');
            globalThis.localStorage.setItem('apple_business_current_user', JSON.stringify(user));
          },
          {
            id: setup.operationUser.id,
            username: setup.credentials.operation.username,
            displayName: 'UIUX Probe Operation',
            roles: ['operation'],
            permissions: ['code.order.view', 'notification.view']
          }
        );
        const page = await context.newPage();
        const consoleErrors = collectConsoleErrors(page);

        await page.goto(`${adminBaseUrl}/dashboard`);
        await page.waitForURL('**/login?redirect=/dashboard', { timeout: 15000 });
        const screenshotPath = await screenshot(page, '26-real-session-expired-redirect.png');
        const state = {
          url: page.url(),
          hasLoginButton: await page.getByRole('button', { name: '登录', exact: true }).count(),
          tokenCleared: await page.evaluate(
            () => !globalThis.localStorage.getItem('apple_business_access_token')
          )
        };

        await context.close();
        return createResult(
          state.url.includes('/login?redirect=/dashboard') &&
            state.hasLoginButton === 1 &&
            state.tokenCleared,
          state,
          screenshotPath,
          consoleErrors
        );
      });
    } finally {
      await browser.close();
    }
  } finally {
    await closeServer(proxyServer);
    await cleanupProbeUsers(setup);
  }

  const ok = Object.values(results).every(
    (scenario) => scenario.ok && !hasBlockingConsoleErrors(scenario.consoleErrors)
  );

  console.log(
    JSON.stringify(
      {
        ok,
        adminBaseUrl,
        realApiBaseUrl,
        health,
        results
      },
      null,
      2
    )
  );

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
