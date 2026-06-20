#!/usr/bin/env node
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import {
  assertLocalAcceptanceDatabase,
  cleanupLocalAcceptanceData
} from './lib/development-data-cleanup.mjs';

const scrypt = promisify(scryptCallback);
const API_BASE_URL = process.env.ACCEPTANCE_API_BASE_URL ?? 'http://localhost:3000/api';
const ACCEPTANCE_USERNAME = 'acceptance_bot';

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
    // The API and Prisma will report precise connection errors later.
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function ensureAcceptanceUser(prisma) {
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await hashPassword(password);
  const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });

  if (!adminRole) {
    throw new Error('Admin role is missing. Run npm run prisma:seed first.');
  }

  const user = await prisma.user.upsert({
    where: { username: ACCEPTANCE_USERNAME },
    update: {
      passwordHash,
      status: 'active',
      deletedAt: null,
      displayName: '上线验收临时用户'
    },
    create: {
      username: ACCEPTANCE_USERNAME,
      passwordHash,
      displayName: '上线验收临时用户'
    }
  });

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

  return { username: ACCEPTANCE_USERNAME, password, userId: user.id };
}

async function disableAcceptanceUser(prisma, userId) {
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'disabled' }
  });
}

async function unwrap(response, label) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`${label} failed: ${response.status} ${body?.message ?? 'unknown error'}`);
  }
  return body.data;
}

async function expectFailure(promise, label) {
  const response = await promise;
  const body = await response.json().catch(() => null);
  if (response.ok && body?.success) {
    throw new Error(`${label} should fail but succeeded`);
  }
  return {
    status: response.status,
    message: body?.message ?? 'failed as expected'
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createApi(token) {
  async function request(method, path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return unwrap(response, `${method} ${path}`);
  }

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

async function runAppleWorkflow(api, suffix) {
  const platform = await api.post('/source-platforms', {
    name: `验收来源 ${suffix}`,
    code: `acceptance_apple_${suffix}`,
    type: 'manual',
    feeRate: '0',
    feeFixed: '2',
    syncEnabled: false,
    deliveryEnabled: false,
    remark: '上线验收 Apple ID 流程'
  });
  const customer = await api.post('/customers', {
    name: `验收客户 ${suffix}`,
    contactName: '验收联系人',
    phone: '18800001111',
    wechat: `acceptance_${suffix}`,
    sourcePlatformId: platform.id,
    tags: ['acceptance'],
    remark: '上线验收客户'
  });
  const account = await api.post('/apple/accounts', {
    appleId: `acceptance.${suffix}@example.com`,
    password: 'temporary-secret',
    securityInfo: 'acceptance security info',
    region: 'US',
    currency: 'USD',
    currentBalance: '0',
    balanceCostAmount: '0',
    status: 'normal',
    remark: '上线验收 Apple ID'
  });
  const topup = await api.post(`/apple/accounts/${account.id}/topups`, {
    faceValue: '100',
    costAmount: '560',
    giftCardCode: `GIFT-${suffix}-ABCD`,
    remark: '上线验收充值'
  });

  assert(topup.balanceAfter === '100', 'Apple topup should increase balance to 100');
  assert(topup.avgCostAfter === '5.6', 'Apple topup should calculate average cost 5.6');
  assert(topup.hasGiftCardCode === true, 'Apple topup should store encrypted gift card code');
  assert(topup.giftCardCodeTail === 'ABCD', 'Apple topup should expose gift card code tail only');

  const service = await api.post('/apple/services', {
    name: `验收 Apple 业务 ${suffix}`,
    category: 'acceptance',
    defaultPrice: '188',
    officialCostValue: '20',
    currency: 'USD',
    defaultPeriodType: 'day',
    defaultPeriodValue: 1,
    expireCalcType: 'by_day',
    requireAppleId: true,
    requireServiceAccount: false,
    autoMatchAppleId: true,
    lockRule: 'by_service',
    allowedRegions: ['US'],
    minBalanceRequired: '20',
    status: 'enabled',
    remark: '上线验收 Apple 业务'
  });

  const available = await api.get(
    `/apple/matching/available-accounts?serviceId=${service.id}&amountRequired=20&currency=USD&showUnavailable=true`
  );
  assert(
    available.items.some(
      (item) => item.appleAccountId === account.id && item.availability === 'available'
    ),
    'Created Apple account should be available for matching'
  );

  const now = new Date();
  const expireTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const order = await api.post('/apple/orders', {
    customerId: customer.id,
    sourcePlatformId: platform.id,
    externalOrderNo: `APPLE-${suffix}`,
    serviceId: service.id,
    appleAccountId: account.id,
    paidAmount: '188',
    platformFee: '2',
    appleCostValue: '20',
    startTime: now.toISOString(),
    expireTime,
    remark: '上线验收 Apple 订单'
  });

  assert(order.status === 'active', 'Apple order should become active');
  assert(order.activationId, 'Apple order should create service activation');
  assert(order.appleCostRmb === '112', 'Apple order should calculate RMB cost from average cost');
  assert(order.profitAmount === '74', 'Apple order should calculate profit');

  const accountAfterOrder = await api.get(`/apple/accounts/${account.id}`);
  assert(accountAfterOrder.currentBalance === '80', 'Apple order should deduct account balance');
  assert(
    accountAfterOrder.averageCost === '5.6',
    'Apple average cost should stay stable after consumption'
  );

  const generatedTasks = await api.post('/apple/renewal-tasks/generate-due-tasks', {
    daysAhead: 7,
    now: now.toISOString()
  });
  assert(generatedTasks.scannedActivations >= 1, 'Renewal task generation should scan activation');
  assert(
    generatedTasks.createdCount + generatedTasks.updatedCount >= 1,
    'Renewal task generation should create or update at least one task'
  );

  const generatedPlans = await api.post('/apple/action-plans/generate', {
    daysAhead: 7,
    now: now.toISOString()
  });
  assert(generatedPlans.scannedActivations >= 1, 'Action plan generation should scan activation');
  assert(
    generatedPlans.createdCount + generatedPlans.updatedCount >= 1,
    'Action plan generation should create or update at least one plan'
  );

  const report = await api.get(`/apple/reports/profit?keyword=APPLE-${suffix}`);
  assert(report.summary.orderCount >= 1, 'Apple profit report should include acceptance order');

  return {
    customerId: customer.id,
    appleAccountId: account.id,
    appleOrderId: order.id,
    activationId: order.activationId,
    renewalTasksTouched: generatedTasks.createdCount + generatedTasks.updatedCount,
    actionPlansTouched: generatedPlans.createdCount + generatedPlans.updatedCount,
    profit: order.profitAmount
  };
}

async function runCodeWorkflow(api, suffix) {
  const platform = await api.post('/source-platforms', {
    name: `验收发货平台 ${suffix}`,
    code: `acceptance_code_${suffix}`,
    type: 'taobao',
    feeRate: '0',
    feeFixed: '2',
    syncEnabled: false,
    deliveryEnabled: true,
    remark: '上线验收兑换码平台'
  });
  const service = await api.post('/codes/services', {
    name: `验收兑换码业务 ${suffix}`,
    faceValue: '100',
    defaultPrice: '120',
    defaultCost: '90',
    deliveryMode: 'semi_auto',
    status: 'enabled',
    remark: '上线验收兑换码业务'
  });

  await api.post('/codes/platform-mappings', {
    platformId: platform.id,
    platformItemId: `ITEM-${suffix}`,
    platformSkuId: `SKU-${suffix}`,
    skuKeyword: '100元',
    serviceId: service.id,
    faceValue: '100',
    quantity: 1,
    enabled: true
  });

  const batch = await api.post('/codes/batches/import', {
    serviceId: service.id,
    batchNo: `BATCH-${suffix}`,
    defaultCost: '90',
    codes: [`CODE-${suffix}-0001`, `CODE-${suffix}-0002`],
    remark: '上线验收兑换码导入'
  });
  assert(batch.successCount === 2, 'Redeem code import should create two codes');
  assert(batch.failedCount === 0, 'Redeem code import should have no failures');

  const order = await api.post('/codes/orders/manual', {
    platformId: platform.id,
    externalOrderNo: `CODE-ORDER-${suffix}`,
    buyerId: `buyer-${suffix}`,
    buyerNameMasked: '买家***',
    itemId: `ITEM-${suffix}`,
    skuId: `SKU-${suffix}`,
    itemTitle: '100元兑换码',
    skuName: '100元',
    paidAmount: '120',
    platformFee: '2',
    orderStatus: 'paid',
    paidAt: new Date().toISOString()
  });
  assert(order.serviceId === service.id, 'Code order should resolve service from platform mapping');
  assert(order.profitAmount === '118', 'Code order should calculate pre-lock profit');

  const lockedOrder = await api.post(`/codes/orders/${order.id}/match-code`);
  assert(lockedOrder.lockedCodeCount === 1, 'Code order should lock one redeem code');
  assert(lockedOrder.costAmount === '90', 'Code order should calculate locked code cost');
  assert(lockedOrder.profitAmount === '28', 'Code order should calculate post-lock profit');

  const deliveryPreview = await api.post(`/codes/orders/${order.id}/generate-delivery-content`, {
    reason: '上线验收生成发货内容'
  });
  assert(deliveryPreview.codeCount === 1, 'Delivery content should include one code');
  assert(
    deliveryPreview.deliveryContent.includes(`CODE-${suffix}-0001`),
    'Delivery content should include decrypted redeem code'
  );

  const deliveredOrder = await api.post(`/codes/orders/${order.id}/deliver`, {
    deliveryMethod: 'manual',
    deliveryContent: deliveryPreview.deliveryContent
  });
  assert(deliveredOrder.deliveryStatus === 'delivered', 'Code order should become delivered');
  assert(deliveredOrder.deliveredCodeCount === 1, 'Code order should mark one code delivered');

  const duplicateDelivery = await expectFailure(
    api.rawPost(`/codes/orders/${order.id}/deliver`, {
      deliveryMethod: 'manual',
      deliveryContent: deliveryPreview.deliveryContent
    }),
    'duplicate delivery'
  );
  assert(duplicateDelivery.status === 409, 'Duplicate delivery should be rejected with 409');

  const deliveryLogs = await api.get(`/codes/orders/${order.id}/delivery-logs`);
  assert(deliveryLogs.items.length >= 1, 'Code order should write delivery log');

  const report = await api.get(`/codes/reports/profit?keyword=CODE-ORDER-${suffix}`);
  assert(report.summary.orderCount >= 1, 'Code profit report should include acceptance order');

  return {
    platformId: platform.id,
    codeServiceId: service.id,
    codeOrderId: order.id,
    lockedCodeCount: lockedOrder.lockedCodeCount,
    deliveredCodeCount: deliveredOrder.deliveredCodeCount,
    duplicateDeliveryStatus: duplicateDelivery.status,
    profit: deliveredOrder.profitAmount
  };
}

async function updateLaunchChecklist(api, evidence) {
  const checklist = await api.get('/maintenance/launch-checklist');
  const now = new Date().toISOString();
  const items = checklist.items.map((item) => {
    if (item.id === 'apple_e2e') {
      return {
        ...item,
        status: 'passed',
        owner: '技术',
        evidence: evidence.apple,
        remark: '本地 API 验收脚本已通过 Apple ID 代充闭环',
        updatedAt: now
      };
    }
    if (item.id === 'code_e2e') {
      return {
        ...item,
        status: 'passed',
        owner: '技术',
        evidence: evidence.code,
        remark: '本地 API 验收脚本已通过兑换码半自动发货闭环',
        updatedAt: now
      };
    }
    return item;
  });

  return api.patch('/maintenance/launch-checklist', { items });
}

async function main() {
  loadDotEnv();
  assertLocalAcceptanceDatabase(API_BASE_URL, process.env.DATABASE_URL);
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let acceptanceUserId = null;

  try {
    const health = await fetch(`${API_BASE_URL}/health/ready`);
    await unwrap(health, 'GET /health/ready');

    const credentials = await ensureAcceptanceUser(prisma);
    acceptanceUserId = credentials.userId;
    const token = await login(credentials.username, credentials.password);
    const api = createApi(token);
    const suffix = String(Date.now());

    const apple = await runAppleWorkflow(api, suffix);
    const code = await runCodeWorkflow(api, suffix);

    if (process.env.ACCEPTANCE_UPDATE_CHECKLIST === '1') {
      await updateLaunchChecklist(api, {
        apple: `scripts/acceptance-business-workflows.mjs apple ${apple.appleOrderId}`,
        code: `scripts/acceptance-business-workflows.mjs code ${code.codeOrderId}`
      });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBaseUrl: API_BASE_URL,
          suffix,
          apple,
          code
        },
        null,
        2
      )
    );
  } finally {
    await disableAcceptanceUser(prisma, acceptanceUserId);
    const cleanup = await cleanupLocalAcceptanceData(prisma, API_BASE_URL);
    if (!cleanup.skipped) {
      console.error('Local acceptance data was cleaned after business workflow.');
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
