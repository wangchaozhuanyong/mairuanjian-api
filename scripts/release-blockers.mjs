#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

const checklistIds = ['telegram_test', 'prod_env', 'git_baseline'];
const passedStatuses = new Set(['passed']);

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

function run(command, args) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function firstLines(value, count = 5) {
  return value
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.replace(/^- /, ''))
    .slice(0, count);
}

function productionEnvStatus() {
  if (!existsSync('.env.production')) {
    return {
      ok: false,
      summary: 'Missing .env.production',
      details: ['Run npm run prod:env:init, then set real production values.']
    };
  }

  const result = run(process.execPath, ['scripts/validate-production-env.mjs']);
  if (result.status === 0) {
    return {
      ok: true,
      summary: 'Production env check passed',
      details: []
    };
  }

  return {
    ok: false,
    summary: 'Production env check failed',
    details: firstLines(result.stderr || result.stdout)
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

async function databaseStatus() {
  const PrismaClient = await loadPrismaClient();
  if (PrismaClient.error) {
    return {
      ok: false,
      telegramOk: false,
      checklist: new Map(),
      details: [PrismaClient.error]
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
    const successfulTelegram = telegramConfigs.find(
      (config) =>
        config.enabled &&
        config.botTokenEncrypted &&
        config.chatId &&
        config.lastTestStatus === 'success'
    );
    const checklist = new Map(
      normalizeChecklistItems(checklistParameter?.value)
        .filter((item) => checklistIds.includes(item?.id))
        .map((item) => [item.id, item])
    );

    return {
      ok: true,
      telegramOk: Boolean(successfulTelegram),
      telegramSummary: successfulTelegram
        ? `Passed via ${successfulTelegram.notificationName}`
        : 'No enabled Telegram config has a successful real test.',
      checklist,
      details: []
    };
  } catch (error) {
    return {
      ok: false,
      telegramOk: false,
      checklist: new Map(),
      details: [error instanceof Error ? error.message : 'Database check failed']
    };
  } finally {
    await prisma.$disconnect();
  }
}

function gitReadinessStatus() {
  const result = run(process.execPath, ['scripts/git-readiness.mjs']);
  return {
    ok: result.status === 0,
    details: firstLines(result.stderr || result.stdout)
  };
}

function checklistPassed(database, id) {
  const item = database.checklist.get(id);
  return Boolean(item && passedStatuses.has(item.status));
}

function printBlocker({ title, owner, status, action, verify, evidence }) {
  console.log(`- ${title}`);
  console.log(`  owner: ${owner}`);
  console.log(`  status: ${status}`);
  console.log(`  action: ${action}`);
  console.log(`  verify: ${verify}`);
  console.log(`  evidence: ${evidence}`);
}

async function main() {
  loadLocalEnv();

  const [database, productionEnv, git] = await Promise.all([
    databaseStatus(),
    Promise.resolve(productionEnvStatus()),
    Promise.resolve(gitReadinessStatus())
  ]);

  const blockers = [];

  if (!database.telegramOk || !checklistPassed(database, 'telegram_test')) {
    blockers.push({
      title: 'Telegram real test',
      owner: '运营 / 管理员',
      status: database.telegramSummary ?? 'unknown',
      action:
        'Configure a real Telegram Bot Token and Chat ID in /system/notifications, enable it, and send a real test message.',
      verify: 'npm run launch:gates',
      evidence:
        'npm run launch:checklist -- --id=telegram_test --status=passed --evidence="Telegram test send passed in notification center; npm run launch:gates shows Telegram passed"'
    });
  }

  if (!productionEnv.ok || !checklistPassed(database, 'prod_env')) {
    const prodEnvAction = productionEnv.ok
      ? 'Production env check already passed. Review the public values, then record prod_env evidence in the launch checklist.'
      : 'Set FIRST_RELEASE_MODE with npm run prod:env:set-mode -- --mode=semi_auto, set real HTTPS APP_PUBLIC_URL and CORS_ORIGIN, then run production env checks.';

    blockers.push({
      title: 'Production env',
      owner: '技术',
      status: productionEnv.summary,
      action: prodEnvAction,
      verify: 'npm run prod:env:review && npm run prod:env:check',
      evidence:
        'npm run launch:checklist -- --id=prod_env --status=passed --evidence="npm run prod:env:check passed; APP_PUBLIC_URL=https://your-domain.com"'
    });
  }

  if (!git.ok || !checklistPassed(database, 'git_baseline')) {
    blockers.push({
      title: 'Git baseline',
      owner: '负责人',
      status: git.ok
        ? 'Git readiness passed, but checklist is not passed.'
        : 'Git readiness failed.',
      action:
        'Review docs/INITIAL_COMMIT_PLAN.md, approve the initial commit/push strategy, then commit/push only after explicit authorization.',
      verify: 'npm run git:readiness:verbose',
      evidence:
        'npm run launch:checklist -- --id=git_baseline --status=passed --evidence="initial commit pushed to origin/main after npm run release:review and npm run git:readiness:verbose passed"'
    });
  }

  console.log('Release blockers');
  console.log('================');
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(
    'Mode: read-only; no files, database rows, notifications, commits, or pushes are changed.'
  );
  console.log();

  if (blockers.length) {
    console.log(`Blocking items: ${blockers.length}`);
    for (const blocker of blockers) {
      printBlocker(blocker);
    }
  } else {
    console.log(
      'No blocker detected by this report. Run npm run release:ready as the final strict gate.'
    );
  }

  if (!productionEnv.ok && productionEnv.details.length) {
    console.log();
    console.log('Production env details:');
    for (const detail of productionEnv.details) console.log(`- ${detail}`);
  }

  if (!database.ok && database.details.length) {
    console.log();
    console.log('Database details:');
    for (const detail of database.details) console.log(`- ${detail}`);
  }

  console.log();
  console.log('Final gate: npm run release:ready');
}

await main();
