#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

const checklistKey = 'maintenance_launch_checklist';
const allowedStatuses = new Set(['pending', 'in_progress', 'passed', 'blocked', 'waived']);
const evidenceRequiredStatuses = new Set(['passed', 'blocked', 'waived']);
const manualGateIds = new Set(['telegram_test', 'prod_env', 'git_baseline']);
const sensitivePatterns = [
  { name: 'Telegram Bot Token', pattern: /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/ },
  { name: 'OpenAI API key', pattern: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ }
];

const defaultChecklistItems = [
  {
    id: 'quality_gate',
    category: '工程质量',
    title: '完整质量门禁 npm run check 通过',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: 'npm run check',
    remark: '当前基线已通过'
  },
  {
    id: 'prod_config',
    category: '部署',
    title: '生产 Compose 配置校验通过',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: 'npm run prod:config:example',
    remark: '示例配置已验证'
  },
  {
    id: 'prod_images',
    category: '部署',
    title: 'API/Admin 生产镜像可构建',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: 'docker compose build api admin',
    remark: '本机使用传统 Docker 构建模式验证'
  },
  {
    id: 'special_pages',
    category: '体验',
    title: '403、404、维护模式页可访问且非空白',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: '/403 /404 /system/maintenance-mode',
    remark: '浏览器实际渲染已确认'
  },
  {
    id: 'maintenance_guard',
    category: '安全',
    title: '维护模式接入后台全局访问拦截',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: '/maintenance/mode/public + router guard',
    remark: '非允许角色进入维护模式页'
  },
  {
    id: 'apple_e2e',
    category: 'Apple ID',
    title: 'Apple ID 代充业务端到端验收',
    priority: 'P0',
    status: 'pending',
    owner: '业务',
    evidence: '',
    remark: '需用真实样例数据验收订单、成本、续费和报表'
  },
  {
    id: 'code_e2e',
    category: '兑换码',
    title: '兑换码半自动发货端到端验收',
    priority: 'P0',
    status: 'pending',
    owner: '业务',
    evidence: '',
    remark: '需验收导入、去重、锁码、发货、防重复和售后'
  },
  {
    id: 'sensitive_audit',
    category: '安全',
    title: '敏感字段权限、原因和审计回归',
    priority: 'P0',
    status: 'pending',
    owner: '技术',
    evidence: '',
    remark: '覆盖 Apple ID、礼品卡代码、兑换码、客户手机号'
  },
  {
    id: 'backup_restore',
    category: '数据',
    title: '数据库备份和恢复演练完成',
    priority: 'P0',
    status: 'pending',
    owner: '技术',
    evidence: '',
    remark: '至少在非生产环境完成恢复演练'
  },
  {
    id: 'telegram_test',
    category: '通知',
    title: 'Telegram Bot Token / Chat ID 后补填写',
    priority: 'P1',
    status: 'pending',
    owner: '运营',
    evidence: '',
    remark: '半自动首发可先留空；后续在通知中心填写真实 Bot Token 和 Chat ID 后执行测试发送'
  },
  {
    id: 'prod_env',
    category: '部署',
    title: '生产 .env.production 无占位密钥',
    priority: 'P0',
    status: 'pending',
    owner: '技术',
    evidence: '',
    remark: '上线前替换全部 replace_with/change_me 占位'
  },
  {
    id: 'git_baseline',
    category: '发布',
    title: '确认 Git 基线、提交和推送策略',
    priority: 'P0',
    status: 'pending',
    owner: '负责人',
    evidence: '',
    remark: '未获明确要求前不 commit、不 push'
  }
];

function readText(path) {
  return readFileSync(path, 'utf8');
}

function parseEnvFile(path) {
  if (!existsSync(path)) return new Map();

  const values = new Map();
  for (const rawLine of readText(path).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function loadLocalEnv() {
  const env = parseEnvFile('.env');
  for (const [key, value] of env.entries()) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    list: false,
    id: '',
    status: '',
    evidence: '',
    remark: '',
    by: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--list') {
      args.list = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    const option = arg.startsWith('--') ? arg.slice(2) : '';
    const inlineSeparatorIndex = option.indexOf('=');
    const rawKey = inlineSeparatorIndex === -1 ? option : option.slice(0, inlineSeparatorIndex);
    const inlineValue =
      inlineSeparatorIndex === -1 ? undefined : option.slice(inlineSeparatorIndex + 1);
    if (!rawKey) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!(key in args)) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[key] = value;
    if (inlineValue === undefined) index += 1;
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  npm run launch:checklist -- --list
  npm run launch:checklist -- --id=git_baseline --status=passed --evidence="npm run git:readiness passed; user approved initial commit plan"
  npm run launch:checklist -- --id=prod_env --status=passed --evidence="npm run prod:env:check passed; APP_PUBLIC_URL=https://your-domain.com" --dry-run

Allowed manual gate ids:
  ${Array.from(manualGateIds).join(', ')}

Allowed statuses:
  ${Array.from(allowedStatuses).join(', ')}

Note:
  prod_env and git_baseline are first-release P0 gates and cannot be waived.
  telegram_test can stay pending for FIRST_RELEASE_MODE=semi_auto, but it cannot be waived or marked passed before a real successful Telegram test.
`);
}

function normalizeItems(value) {
  const items = value && typeof value === 'object' && !Array.isArray(value) ? value.items : value;
  return Array.isArray(items) ? items : defaultChecklistItems;
}

function assertNoSensitiveText(value, fieldName) {
  for (const rule of sensitivePatterns) {
    if (rule.pattern.test(value)) {
      throw new Error(
        `${fieldName} appears to contain a ${rule.name}. Do not store secrets as evidence.`
      );
    }
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function firstLines(value, count = 4) {
  return value.trim().split(/\r?\n/).filter(Boolean).slice(0, count).join('; ');
}

function validateArgs(args) {
  if (args.list) return;

  if (!manualGateIds.has(args.id)) {
    throw new Error(`--id must be one of: ${Array.from(manualGateIds).join(', ')}`);
  }
  if (!allowedStatuses.has(args.status)) {
    throw new Error(`--status must be one of: ${Array.from(allowedStatuses).join(', ')}`);
  }
  if (args.status === 'waived') {
    throw new Error(`${args.id} is a first-release P0 gate and cannot be waived`);
  }
  if (evidenceRequiredStatuses.has(args.status) && !args.evidence.trim()) {
    throw new Error(`--evidence is required when --status=${args.status}`);
  }

  assertNoSensitiveText(args.evidence, '--evidence');
  assertNoSensitiveText(args.remark, '--remark');
  assertNoSensitiveText(args.by, '--by');
}

async function loadPrismaClient() {
  try {
    const module = await import('@prisma/client');
    return module.PrismaClient;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Cannot load @prisma/client', {
      cause: error
    });
  }
}

function assertProductionEnvCanPass() {
  const result = run(process.execPath, ['scripts/validate-production-env.mjs']);
  if (result.status !== 0) {
    throw new Error(
      `prod_env cannot be marked passed because npm run prod:env:check fails: ${firstLines(
        result.stderr || result.stdout
      )}`
    );
  }
}

async function assertTelegramCanPass(prisma) {
  const successfulConfig = await prisma.telegramConfig.findFirst({
    where: {
      deletedAt: null,
      enabled: true,
      botTokenEncrypted: { not: null },
      chatId: { not: '' },
      lastTestStatus: 'success'
    },
    orderBy: [{ lastTestAt: 'desc' }, { updatedAt: 'desc' }]
  });

  if (!successfulConfig) {
    throw new Error(
      'telegram_test cannot be marked passed because no enabled Telegram config has a successful real test'
    );
  }
}

function assertGitBaselineCanPass() {
  const head = run('git', ['rev-parse', '--verify', 'HEAD']);
  if (head.status !== 0) {
    throw new Error(
      'git_baseline cannot be marked passed because the repository has no commit yet'
    );
  }

  const remote = run('git', ['remote', 'get-url', 'origin']);
  if (remote.status !== 0 || !remote.stdout.trim()) {
    throw new Error('git_baseline cannot be marked passed because origin remote is missing');
  }

  const status = run('git', ['status', '--short', '--untracked-files=all']);
  if (status.status !== 0) {
    throw new Error(`git_baseline cannot be marked passed: ${firstLines(status.stderr)}`);
  }
  if (status.stdout.trim()) {
    throw new Error(
      'git_baseline cannot be marked passed because the working tree still has uncommitted or untracked files'
    );
  }
}

async function assertPassedGateIsCurrentlySatisfied(prisma, id, status) {
  if (status !== 'passed') return;

  if (id === 'prod_env') {
    assertProductionEnvCanPass();
    return;
  }

  if (id === 'telegram_test') {
    await assertTelegramCanPass(prisma);
    return;
  }

  if (id === 'git_baseline') {
    assertGitBaselineCanPass();
  }
}

function toStoredItem(item) {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    priority: item.priority,
    status: item.status,
    owner: item.owner ?? null,
    evidence: item.evidence ?? null,
    remark: item.remark ?? null,
    updatedAt: item.updatedAt ?? new Date().toISOString()
  };
}

function printItems(items) {
  for (const item of items.filter((entry) => manualGateIds.has(entry.id))) {
    console.log(`${item.id}: ${item.status} | ${item.title}`);
    if (item.evidence) console.log(`  evidence: ${item.evidence}`);
    if (item.remark) console.log(`  remark: ${item.remark}`);
  }
}

async function main() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Run npm run setup:env or configure .env first.');
  }

  const PrismaClient = await loadPrismaClient();
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.systemParameter.findUnique({
      where: { key: checklistKey }
    });
    const items = normalizeItems(existing?.value).map(toStoredItem);

    if (args.list) {
      printItems(items);
      return;
    }

    const index = items.findIndex((item) => item.id === args.id);
    if (index === -1) {
      throw new Error(`Checklist item ${args.id} not found.`);
    }

    await assertPassedGateIsCurrentlySatisfied(prisma, args.id, args.status);

    const beforeItem = items[index];
    const afterItem = {
      ...beforeItem,
      status: args.status,
      evidence: args.evidence.trim() || beforeItem.evidence,
      remark: args.remark.trim() || beforeItem.remark,
      updatedAt: new Date().toISOString()
    };
    const nextItems = items.toSpliced(index, 1, afterItem);

    console.log(`Launch checklist update: ${args.id} ${beforeItem.status} -> ${args.status}`);
    if (afterItem.evidence) console.log(`Evidence: ${afterItem.evidence}`);
    if (args.dryRun) {
      console.log('Dry run only. No database changes were written.');
      return;
    }

    const parameter = await prisma.systemParameter.upsert({
      where: { key: checklistKey },
      update: {
        value: nextItems,
        group: 'maintenance',
        remark: '上线检查清单'
      },
      create: {
        key: checklistKey,
        value: nextItems,
        group: 'maintenance',
        remark: '上线检查清单'
      }
    });

    await prisma.auditLog.create({
      data: {
        module: 'maintenance',
        action: 'maintenance.launch_checklist.manual_gate.record',
        objectType: 'system_parameter',
        objectId: parameter.id,
        beforeData: { item: beforeItem },
        afterData: { item: afterItem },
        remark: `launch checklist ${args.id} recorded by ${args.by || 'local script'}`
      }
    });

    console.log('Launch checklist evidence recorded.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
