#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

const strict = process.argv.includes('--strict') || process.env.MANUAL_GATES_STRICT === '1';
const targetChecklistIds = ['telegram_test', 'prod_env', 'git_baseline'];
const passingChecklistStatuses = new Set(['passed']);
const checklistTitles = {
  telegram_test: 'Telegram Bot Token / Chat ID 后补填写',
  prod_env: '生产 .env.production 无占位密钥',
  git_baseline: '确认 Git 基线、提交和推送策略'
};

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
  return env;
}

function getReleaseMode() {
  const productionEnv = parseEnvFile('.env.production');
  return (productionEnv.get('FIRST_RELEASE_MODE') || process.env.FIRST_RELEASE_MODE || '').trim();
}

function canDeferTelegramGate() {
  return getReleaseMode() === 'semi_auto';
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function productionEnvStatus() {
  if (!existsSync('.env.production')) {
    return {
      status: 'missing',
      ok: false,
      detail: 'Missing .env.production. Run npm run prod:env:init, then fill real values.'
    };
  }

  const result = run(process.execPath, ['scripts/validate-production-env.mjs']);
  const detail = `${result.stderr || result.stdout}`.trim();
  return {
    status: result.status === 0 ? 'passed' : 'failed',
    ok: result.status === 0,
    detail: result.status === 0 ? 'Production env check passed.' : detail
  };
}

async function loadPrismaClient() {
  try {
    const module = await import('@prisma/client');
    return module.PrismaClient;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Cannot load @prisma/client'
    };
  }
}

function normalizeChecklistItems(value) {
  const items = value && typeof value === 'object' && !Array.isArray(value) ? value.items : value;
  return Array.isArray(items) ? items : [];
}

function tail(value) {
  if (!value) return '-';
  const normalized = String(value);
  return normalized.length <= 4 ? normalized : normalized.slice(-4);
}

function formatUnavailableDetail(error) {
  const message = error instanceof Error ? error.message : String(error || 'Database check failed');
  const databaseHost = message.match(/Can't reach database server at `([^`]+)`/);

  if (databaseHost) {
    return `Database unavailable at ${databaseHost[1]}; runtime checks were used where possible.`;
  }

  const firstLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine
    ? `Database unavailable: ${firstLine}`
    : 'Database unavailable; runtime checks were used where possible.';
}

async function databaseGateStatus() {
  const PrismaClient = await loadPrismaClient();
  if (PrismaClient.error) {
    return {
      ok: false,
      status: 'unknown',
      detail: PrismaClient.error,
      telegram: null,
      checklist: [],
      sourceAvailable: false
    };
  }

  const prisma = new PrismaClient();
  try {
    const [telegramConfigs, checklistParameter] = await Promise.all([
      prisma.telegramConfig.findMany({
        where: { deletedAt: null },
        orderBy: [{ lastTestAt: 'desc' }, { updatedAt: 'desc' }],
        take: 20
      }),
      prisma.systemParameter.findUnique({
        where: { key: 'maintenance_launch_checklist' }
      })
    ]);
    const enabledConfigs = telegramConfigs.filter((config) => config.enabled);
    const successfulConfig = enabledConfigs.find(
      (config) => config.botTokenEncrypted && config.chatId && config.lastTestStatus === 'success'
    );
    const checklist = normalizeChecklistItems(checklistParameter?.value).filter((item) =>
      targetChecklistIds.includes(item?.id)
    );

    return {
      ok: Boolean(successfulConfig),
      status: successfulConfig ? 'passed' : 'failed',
      detail: successfulConfig
        ? `Enabled Telegram config tested successfully at ${successfulConfig.lastTestAt?.toISOString() ?? 'unknown time'}.`
        : 'No enabled Telegram config has lastTestStatus=success.',
      telegram: {
        total: telegramConfigs.length,
        enabled: enabledConfigs.length,
        successful: successfulConfig
          ? {
              name: successfulConfig.notificationName,
              chatIdTail: tail(successfulConfig.chatId),
              botTokenTail: successfulConfig.botTokenTail ?? '-',
              lastTestAt: successfulConfig.lastTestAt?.toISOString() ?? null
            }
          : null,
        latestError:
          enabledConfigs.find((config) => config.lastTestError)?.lastTestError ??
          telegramConfigs.find((config) => config.lastTestError)?.lastTestError ??
          null
      },
      checklist,
      sourceAvailable: true
    };
  } catch (error) {
    return {
      ok: false,
      status: 'unknown',
      detail: formatUnavailableDetail(error),
      telegram: null,
      checklist: [],
      sourceAvailable: false
    };
  } finally {
    await prisma.$disconnect();
  }
}

function printProduction(status) {
  console.log(`Production env: ${status.status}`);
  console.log(status.detail);
}

function printTelegram(status, deferred) {
  if (deferred && status.status !== 'passed') {
    console.log('Telegram real test: deferred');
    console.log(
      'Semi-auto release keeps Telegram Bot Token and Chat ID fields available in /system/notifications for later setup.'
    );
  } else {
    console.log(`Telegram real test: ${status.status}`);
    console.log(status.detail);
  }
  if (!status.telegram) {
    if (status.sourceAvailable === false) {
      console.log(`Telegram configs: not checked (${status.detail})`);
    }
    return;
  }

  console.log(`Telegram configs: ${status.telegram.enabled}/${status.telegram.total} enabled`);
  if (status.telegram.successful) {
    console.log(`Successful config: ${status.telegram.successful.name}`);
    console.log(`Chat ID tail: ${status.telegram.successful.chatIdTail}`);
    console.log(`Bot token tail: ${status.telegram.successful.botTokenTail}`);
  }
  if (status.telegram.latestError) {
    console.log(`Latest Telegram error: ${status.telegram.latestError}`);
  }
}

function printChecklist(items, options = {}) {
  const deferredIds = options.deferredIds ?? new Set();
  const runtimePassedIds = options.runtimePassedIds ?? new Set();
  const runtimeFailedIds = options.runtimeFailedIds ?? new Set();
  const databaseAvailable = options.databaseAvailable ?? true;

  console.log('Launch checklist manual items:');
  const itemsById = new Map(items.map((item) => [item.id, item]));

  for (const id of targetChecklistIds) {
    const item = itemsById.get(id);
    const title = item?.title ?? checklistTitles[id] ?? id;

    if (runtimeFailedIds.has(id)) {
      console.log(`  - ${id}: runtime-failed | ${title}`);
      if (item?.status) {
        console.log(`    stored checklist status: ${item.status}`);
      }
      continue;
    }

    if (deferredIds.has(id) && item?.status !== 'passed') {
      console.log(`  - ${id}: deferred | ${checklistTitles[id] ?? title}`);
      if (item?.status && item.status !== 'pending') {
        console.log(`    stored checklist status: ${item.status}`);
      }
      continue;
    }

    if (runtimePassedIds.has(id) && (!item || !passingChecklistStatuses.has(item.status))) {
      console.log(`  - ${id}: runtime-passed | ${title}`);
      if (item?.status) {
        console.log(`    stored checklist status: ${item.status}`);
      }
      continue;
    }

    if (!item) {
      console.log(
        `  - ${id}: ${databaseAvailable ? 'missing' : 'not-checked'} | ${
          databaseAvailable
            ? 'required first-release manual gate'
            : 'checklist database unavailable'
        }`
      );
      continue;
    }
    console.log(`  - ${item.id}: ${item.status} | ${item.title}`);
    if (item.evidence) {
      console.log(`    evidence: ${item.evidence}`);
    }
  }
}

function gitReadinessStatus() {
  const result = run(process.execPath, ['scripts/git-readiness.mjs']);
  const status = run('git', ['status', '--short', '--untracked-files=all']);
  const hasChanges = Boolean(status.stdout.trim());

  return {
    ok: result.status === 0 && status.status === 0 && !hasChanges,
    detail: hasChanges
      ? 'Working tree has uncommitted or untracked files.'
      : `${result.stderr || result.stdout}`.trim()
  };
}

function checklistBlockers(items, deferredIds = new Set(), runtimePassedIds = new Set()) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return targetChecklistIds
    .filter((id) => !deferredIds.has(id))
    .map((id) => {
      const item = itemsById.get(id);
      if (runtimePassedIds.has(id)) return null;
      if (!item) return `launch checklist missing: ${id}`;
      if (!passingChecklistStatuses.has(item.status)) return `launch checklist: ${id}`;
      return null;
    })
    .filter(Boolean);
}

async function main() {
  loadLocalEnv();
  const telegramDeferred = canDeferTelegramGate();
  const deferredChecklistIds = telegramDeferred ? new Set(['telegram_test']) : new Set();
  const production = productionEnvStatus();
  const database = await databaseGateStatus();
  const git = gitReadinessStatus();
  const runtimePassedIds = new Set();
  if (production.ok) runtimePassedIds.add('prod_env');
  if (git.ok) runtimePassedIds.add('git_baseline');
  const runtimeFailedIds = new Set();
  if (!production.ok) runtimeFailedIds.add('prod_env');
  if (!git.ok) runtimeFailedIds.add('git_baseline');
  const blockers = [];

  if (!production.ok) blockers.push('production env');
  if (!database.ok && !telegramDeferred) blockers.push('Telegram real test');
  if (!git.ok) blockers.push('git baseline');
  blockers.push(...checklistBlockers(database.checklist, deferredChecklistIds, runtimePassedIds));

  console.log('Manual launch gates');
  console.log('===================');
  console.log();
  printProduction(production);
  console.log();
  printTelegram(database, telegramDeferred);
  console.log();
  printChecklist(database.checklist, {
    deferredIds: deferredChecklistIds,
    runtimePassedIds,
    runtimeFailedIds,
    databaseAvailable: database.sourceAvailable !== false
  });
  console.log();

  if (blockers.length) {
    console.log(`Manual gates: blocked (${blockers.join(', ')})`);
    if (strict) process.exitCode = 1;
    return;
  }

  console.log('Manual gates: passed');
}

await main();
