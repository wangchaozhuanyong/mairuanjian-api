#!/usr/bin/env node
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const API_BASE_URL = process.env.ACCEPTANCE_API_BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_USERNAME = 'acceptance_sensitive_admin';
const VIEWER_USERNAME = 'acceptance_sensitive_viewer';
const VIEWER_ROLE_CODE = 'acceptance_sensitive_viewer';
const VIEWER_PERMISSIONS = [
  'apple.account.view',
  'apple.balance.view',
  'code.inventory.view',
  'customer.view'
];

function loadDotEnv() {
  try {
    const env = readFileSync('.env', 'utf8');
    for (const line of env.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1);
      process.env[key] ??= value;
    }
  } catch {
    // Prisma and the API health check will surface precise errors later.
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function createTemporaryUser(prisma, username, displayName) {
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      status: 'active',
      deletedAt: null,
      displayName
    },
    create: {
      username,
      passwordHash,
      displayName
    }
  });

  return { user, password };
}

async function ensureAdminUser(prisma) {
  const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
  if (!adminRole) {
    throw new Error('Admin role is missing. Run npm run prisma:seed first.');
  }

  const { user, password } = await createTemporaryUser(prisma, ADMIN_USERNAME, '敏感回归管理员');
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id
    }
  });

  return { username: ADMIN_USERNAME, password, userId: user.id };
}

async function ensureViewerUser(prisma) {
  const permissions = await prisma.permission.findMany({
    where: { code: { in: VIEWER_PERMISSIONS } }
  });
  const missingPermissions = VIEWER_PERMISSIONS.filter(
    (code) => !permissions.some((permission) => permission.code === code)
  );

  if (missingPermissions.length) {
    throw new Error(`Missing permissions: ${missingPermissions.join(', ')}`);
  }

  const role = await prisma.role.upsert({
    where: { code: VIEWER_ROLE_CODE },
    update: {
      name: '敏感字段基础查看验收角色',
      description: '上线验收临时角色：只有基础查看权限，不允许查看完整敏感字段'
    },
    create: {
      code: VIEWER_ROLE_CODE,
      name: '敏感字段基础查看验收角色',
      description: '上线验收临时角色：只有基础查看权限，不允许查看完整敏感字段'
    }
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id
    }))
  });

  const { user, password } = await createTemporaryUser(prisma, VIEWER_USERNAME, '敏感回归查看员');
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id
    }
  });

  return { username: VIEWER_USERNAME, password, userId: user.id };
}

async function disableTemporaryUsers(prisma, userIds) {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;
  await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { status: 'disabled' }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function unwrap(response, label) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`${label} failed: ${response.status} ${body?.message ?? 'unknown error'}`);
  }
  return body.data;
}

async function expectHttpFailure(response, expectedStatus, label) {
  const body = await response.json().catch(() => null);
  if (response.status !== expectedStatus || (response.ok && body?.success)) {
    throw new Error(
      `${label} should fail with ${expectedStatus} but got ${response.status} ${
        body?.message ?? ''
      }`
    );
  }
}

function createApi(token) {
  async function raw(method, path, body) {
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  async function request(method, path, body) {
    return unwrap(await raw(method, path, body), `${method} ${path}`);
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    rawPost: (path, body) => raw('POST', path, body)
  };
}

async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await unwrap(response, 'POST /auth/login');
  assert(data.accessToken, 'Login response is missing access token');
  return data.accessToken;
}

async function createAcceptanceRecords(api, suffix) {
  const platform = await api.post('/source-platforms', {
    name: `敏感验收来源 ${suffix}`,
    code: `sensitive_platform_${suffix}`,
    type: 'manual',
    feeRate: '0',
    feeFixed: '0',
    syncEnabled: false,
    deliveryEnabled: false,
    remark: '敏感字段上线回归'
  });

  const customer = await api.post('/customers', {
    name: `敏感验收客户 ${suffix}`,
    contactName: '敏感验收',
    phone: `188${suffix.slice(-8)}`,
    sourcePlatformId: platform.id,
    tags: ['acceptance-sensitive'],
    remark: '敏感字段上线回归'
  });

  const appleAccount = await api.post('/apple/accounts', {
    appleId: `sensitive.${suffix}@example.com`,
    password: `apple-password-${suffix}`,
    securityInfo: `security-${suffix}`,
    phone: `177${suffix.slice(-8)}`,
    recoveryEmail: `recover.${suffix}@example.com`,
    region: 'US',
    currency: 'USD',
    currentBalance: '0',
    balanceCostAmount: '0',
    status: 'normal',
    remark: '敏感字段上线回归'
  });

  const topup = await api.post(`/apple/accounts/${appleAccount.id}/topups`, {
    faceValue: '10',
    costAmount: '56',
    giftCardCode: `GIFT-SENSITIVE-${suffix}`,
    remark: '敏感字段上线回归'
  });

  const codeService = await api.post('/codes/services', {
    name: `敏感验收兑换码 ${suffix}`,
    faceValue: '10',
    defaultPrice: '12',
    defaultCost: '9',
    deliveryMode: 'semi_auto',
    status: 'enabled',
    remark: '敏感字段上线回归'
  });

  await api.post('/codes/batches/import', {
    serviceId: codeService.id,
    batchNo: `SENSITIVE-${suffix}`,
    defaultCost: '9',
    codes: [`REDEEM-SENSITIVE-${suffix}`],
    remark: '敏感字段上线回归'
  });

  const inventory = await api.get(`/codes/inventory?serviceId=${codeService.id}&pageSize=5`);
  const redeemCode = inventory.items.find((item) => item.serviceId === codeService.id);
  assert(redeemCode?.id, 'Acceptance redeem code was not found in inventory');

  return {
    customer,
    appleAccount,
    topup,
    redeemCode,
    secrets: {
      customerPhone: `188${suffix.slice(-8)}`,
      applePassword: `apple-password-${suffix}`,
      giftCardCode: `GIFT-SENSITIVE-${suffix}`,
      redeemCode: `REDEEM-SENSITIVE-${suffix}`
    }
  };
}

async function assertSensitiveEvidence(prisma, evidence) {
  const [sensitiveLog, auditLog] = await Promise.all([
    prisma.sensitiveAccessLog.findFirst({
      where: {
        userId: evidence.userId,
        module: evidence.module,
        fieldName: evidence.fieldName,
        objectType: evidence.objectType,
        objectId: evidence.objectId,
        createdAt: { gte: evidence.startedAt }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.auditLog.findFirst({
      where: {
        userId: evidence.userId,
        action: evidence.action,
        objectType: evidence.objectType,
        objectId: evidence.objectId,
        createdAt: { gte: evidence.startedAt }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  assert(sensitiveLog, `${evidence.label} did not write sensitive_access_logs`);
  assert(sensitiveLog.accessReason === evidence.reason, `${evidence.label} reason was not saved`);
  assert(sensitiveLog.approved === true, `${evidence.label} was not marked approved`);
  assert(auditLog, `${evidence.label} did not write audit_logs`);
  assert(
    !JSON.stringify(auditLog.afterData ?? {}).includes(evidence.plaintext),
    `${evidence.label} leaked plaintext into audit log`
  );
}

async function runSensitiveChecks(prisma, adminApi, viewerApi, adminUserId, records) {
  const reason = '上线前敏感字段权限和审计回归';
  const cases = [
    {
      label: 'Apple ID 密码',
      path: `/apple/accounts/${records.appleAccount.id}/reveal-secret`,
      body: { field: 'password', reason },
      blankBody: { field: 'password', reason: ' ' },
      resultKey: 'value',
      plaintext: records.secrets.applePassword,
      module: 'apple_account',
      fieldName: 'password',
      objectType: 'apple_account',
      objectId: records.appleAccount.id,
      action: 'apple_account.secret.reveal'
    },
    {
      label: 'Apple ID 礼品卡代码',
      path: `/apple/topups/${records.topup.id}/reveal-gift-card-code`,
      body: { reason },
      blankBody: { reason: ' ' },
      resultKey: 'giftCardCode',
      plaintext: records.secrets.giftCardCode,
      module: 'apple_balance',
      fieldName: 'giftCardCode',
      objectType: 'apple_balance_topup',
      objectId: records.topup.id,
      action: 'apple_topup.gift_card_code.reveal'
    },
    {
      label: '兑换码完整码',
      path: `/codes/inventory/${records.redeemCode.id}/reveal`,
      body: { reason },
      blankBody: { reason: ' ' },
      resultKey: 'redeemCode',
      plaintext: records.secrets.redeemCode,
      module: 'redeem_code',
      fieldName: 'redeemCode',
      objectType: 'redeem_code',
      objectId: records.redeemCode.id,
      action: 'redeem_code.reveal'
    },
    {
      label: '客户手机号',
      path: `/customers/${records.customer.id}/reveal-phone`,
      body: { reason },
      blankBody: { reason: ' ' },
      resultKey: 'phone',
      plaintext: records.secrets.customerPhone,
      module: 'customer',
      fieldName: 'phone',
      objectType: 'customer',
      objectId: records.customer.id,
      action: 'customer.phone.reveal'
    }
  ];

  const passed = [];

  for (const item of cases) {
    await expectHttpFailure(
      await adminApi.rawPost(item.path, item.blankBody),
      400,
      `${item.label} blank reason`
    );
    await expectHttpFailure(
      await viewerApi.rawPost(item.path, item.body),
      403,
      `${item.label} no full permission`
    );

    const startedAt = new Date();
    const revealed = await adminApi.post(item.path, item.body);
    assert(
      revealed[item.resultKey] === item.plaintext,
      `${item.label} reveal response did not match expected plaintext`
    );

    await assertSensitiveEvidence(prisma, {
      label: item.label,
      userId: adminUserId,
      module: item.module,
      fieldName: item.fieldName,
      objectType: item.objectType,
      objectId: item.objectId,
      action: item.action,
      reason,
      plaintext: item.plaintext,
      startedAt
    });

    passed.push(item.label);
  }

  return passed;
}

async function updateLaunchChecklist(api, evidence) {
  const checklist = await api.get('/maintenance/launch-checklist');
  const now = new Date().toISOString();
  const items = checklist.items.map((item) => {
    if (item.id !== 'sensitive_audit') {
      return item;
    }

    return {
      ...item,
      status: 'passed',
      owner: '技术',
      evidence,
      remark: '本地 API 验收脚本已通过四类敏感字段权限、原因、审计和敏感访问日志回归',
      updatedAt: now
    };
  });

  return api.patch('/maintenance/launch-checklist', { items });
}

async function main() {
  loadDotEnv();
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const temporaryUserIds = [];

  try {
    const health = await fetch(`${API_BASE_URL}/health/ready`);
    await unwrap(health, 'GET /health/ready');

    const adminCredentials = await ensureAdminUser(prisma);
    temporaryUserIds.push(adminCredentials.userId);
    const viewerCredentials = await ensureViewerUser(prisma);
    temporaryUserIds.push(viewerCredentials.userId);

    const adminToken = await login(adminCredentials.username, adminCredentials.password);
    const viewerToken = await login(viewerCredentials.username, viewerCredentials.password);
    const adminApi = createApi(adminToken);
    const viewerApi = createApi(viewerToken);
    const suffix = String(Date.now());

    const records = await createAcceptanceRecords(adminApi, suffix);
    const passed = await runSensitiveChecks(
      prisma,
      adminApi,
      viewerApi,
      adminCredentials.userId,
      records
    );

    await updateLaunchChecklist(adminApi, `scripts/acceptance-sensitive-security.mjs ${suffix}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBaseUrl: API_BASE_URL,
          suffix,
          checked: passed
        },
        null,
        2
      )
    );
  } finally {
    await disableTemporaryUsers(prisma, temporaryUserIds);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
