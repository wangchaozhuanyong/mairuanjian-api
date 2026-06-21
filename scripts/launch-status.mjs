#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

const checklistIds = ['telegram_test', 'prod_env', 'git_baseline'];
const passedChecklistStatuses = new Set(['passed']);

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readEnvValue(filePath, key) {
  if (!existsSync(filePath)) return null;

  const line = readText(filePath)
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`));
  if (!line) return null;

  return (
    line
      .slice(key.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '') || null
  );
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

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
}

function extractSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return '';

  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith('## ') && line.trim() !== heading
  );

  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

function parseTasks(section) {
  return section
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^- \[(x| )\] (T\d+)\s+(.+)$/);
      if (!match) return null;
      return {
        done: match[1] === 'x',
        code: match[2],
        title: match[3].trim()
      };
    })
    .filter(Boolean);
}

function summarizeTasks(label, tasks) {
  const done = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  return {
    label,
    done,
    total,
    open: tasks.filter((task) => !task.done)
  };
}

function getProductionEnvStatus() {
  if (!existsSync('.env.production')) {
    return {
      status: 'missing',
      detail: 'Missing .env.production. Run npm run prod:env:init, then fill real domain values.'
    };
  }

  const result = run(process.execPath, ['scripts/validate-production-env.mjs']);
  if (result.status === 0) {
    return {
      status: 'passed',
      detail: 'Production env check passed.'
    };
  }

  const detail = `${result.stderr || result.stdout}`.trim();
  return {
    status: 'failed',
    detail: detail || 'Production env check failed.'
  };
}

function getGitStatus() {
  const remote = run('git', ['remote', 'get-url', 'origin']);
  const status = run('git', ['status', '--short', '--untracked-files=all']);
  const branch = run('git', ['branch', '--show-current']);
  const changedFiles = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    branch: branch.status === 0 ? branch.stdout.trim() || '(detached)' : 'unknown',
    remote: remote.status === 0 ? remote.stdout.trim() : 'missing',
    changedCount: changedFiles.length,
    hasChanges: changedFiles.length > 0
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

function formatUnavailableDetail(error) {
  const message =
    error instanceof Error ? error.message : String(error || 'Manual gate check failed');
  const databaseHost = message.match(/Can't reach database server at `([^`]+)`/);

  if (databaseHost) {
    return `database unavailable at ${databaseHost[1]}; runtime checks were used where possible`;
  }

  const firstLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine
    ? `database unavailable: ${firstLine}`
    : 'database unavailable; runtime checks were used where possible';
}

async function getManualGateStatus() {
  const PrismaClient = await loadPrismaClient();
  if (PrismaClient.error) {
    return {
      ok: false,
      telegramPassed: false,
      checklist: new Map(),
      detail: formatUnavailableDetail(PrismaClient.error),
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
      telegramPassed: Boolean(successfulTelegram),
      checklist,
      detail: successfulTelegram
        ? `Telegram passed via ${successfulTelegram.notificationName}.`
        : 'No enabled Telegram config has a successful real test.',
      sourceAvailable: true
    };
  } catch (error) {
    return {
      ok: false,
      telegramPassed: false,
      checklist: new Map(),
      detail: formatUnavailableDetail(error),
      sourceAvailable: false
    };
  } finally {
    await prisma.$disconnect();
  }
}

function checklistPassed(manualGates, id) {
  const item = manualGates.checklist.get(id);
  return Boolean(item && passedChecklistStatuses.has(item.status));
}

function getLaunchStrategy() {
  const candidates = [
    { source: '.env.production', mode: readEnvValue('.env.production', 'FIRST_RELEASE_MODE') },
    { source: '.env', mode: readEnvValue('.env', 'FIRST_RELEASE_MODE') },
    { source: '.env.example', mode: readEnvValue('.env.example', 'FIRST_RELEASE_MODE') }
  ];
  const selected = candidates.find((candidate) => candidate.mode);
  const mode = selected?.mode ?? 'semi_auto';
  const normalizedMode = mode === 'full_auto' ? 'full_auto' : 'semi_auto';
  const productionEnvExists = existsSync('.env.production');
  const productionConfigured = Boolean(candidates[0].mode);
  const sourceNote = productionConfigured
    ? ''
    : productionEnvExists
      ? ' (.env.production missing FIRST_RELEASE_MODE)'
      : ' (.env.production missing)';

  return {
    mode: normalizedMode,
    source: selected?.source ?? 'default',
    sourceNote,
    productionConfigured,
    label: normalizedMode === 'full_auto' ? '全自动上线' : '半自动可运营优先',
    detail:
      normalizedMode === 'full_auto'
        ? 'Full-auto mode makes Taobao/Xianyu real adapters and Apple ID real worker launch blockers.'
        : 'Semi-auto mode allows Taobao/Xianyu real adapters, Apple ID real worker, and Telegram real test to ship after first internal launch.'
  };
}

function canDeferTelegramGate(launchStrategy) {
  return launchStrategy.mode === 'semi_auto';
}

function getRuntimeResolvedPhase16Codes(productionEnv, manualGates, launchStrategy) {
  const resolved = new Set();

  if (
    canDeferTelegramGate(launchStrategy) ||
    (manualGates.telegramPassed && checklistPassed(manualGates, 'telegram_test'))
  ) {
    resolved.add('T1612');
  }

  if (productionEnv.status === 'passed' && checklistPassed(manualGates, 'prod_env')) {
    resolved.add('T1613');
  }

  return resolved;
}

function applyRuntimeResolvedTasks(summary, resolvedCodes) {
  const resolvedOpen = summary.open.filter((task) => resolvedCodes.has(task.code));
  return {
    ...summary,
    done: summary.done + resolvedOpen.length,
    open: summary.open.filter((task) => !resolvedCodes.has(task.code))
  };
}

function getFirstReleaseGateSummary(
  phase16,
  phase17,
  productionEnv,
  launchStrategy,
  manualGates,
  git
) {
  const blockers = [];
  const blockerCodes = new Set();
  const telegramDeferred = canDeferTelegramGate(launchStrategy);

  for (const task of phase16.open) {
    blockers.push({ code: task.code, title: task.title, source: 'Phase 16' });
    blockerCodes.add(task.code);
  }

  if (productionEnv.status !== 'passed' && !blockerCodes.has('T1613')) {
    blockers.push({
      code: 'PROD_ENV',
      title: productionEnv.detail.split(/\r?\n/)[0] || 'Production env check did not pass',
      source: 'Production env'
    });
  }

  if (
    productionEnv.status !== 'passed' &&
    !blockerCodes.has('T1613') &&
    !blockerCodes.has('PROD_ENV')
  ) {
    blockers.push({
      code: 'T1613',
      title: '准备生产 `.env.production`，确认没有占位密钥和明文敏感信息',
      source: 'Launch checklist'
    });
    blockerCodes.add('T1613');
  }

  if (
    !telegramDeferred &&
    (!manualGates.telegramPassed || !checklistPassed(manualGates, 'telegram_test')) &&
    !blockerCodes.has('T1612')
  ) {
    blockers.push({
      code: 'T1612',
      title: '完成 Telegram 真实测试发送',
      source: 'Launch checklist'
    });
    blockerCodes.add('T1612');
  }

  if (git.remote === 'missing' || git.hasChanges) {
    blockers.push({
      code: 'GIT_BASELINE',
      title: '确认 Git 基线、提交和推送策略',
      source: 'Launch checklist'
    });
  }

  if (launchStrategy.mode === 'full_auto') {
    for (const task of phase17.open) {
      blockers.push({ code: task.code, title: task.title, source: 'Phase 17 full_auto' });
    }
  }

  return {
    status: blockers.length ? 'blocked' : 'ready',
    blockers,
    postLaunch:
      launchStrategy.mode === 'semi_auto'
        ? phase17.open.map((task) => ({
            code: task.code,
            title: task.title
          }))
        : []
  };
}

function printTaskSummary(summary) {
  console.log(`${summary.label}: ${summary.done}/${summary.total} done`);
  if (!summary.open.length) return;

  for (const task of summary.open) {
    console.log(`  - ${task.code} ${task.title}`);
  }
}

function printFirstReleaseGate(gate) {
  console.log(`First release gate: ${gate.status}`);

  if (gate.blockers.length) {
    console.log('Blocking before first release:');
    for (const blocker of gate.blockers) {
      console.log(`  - ${blocker.code} ${blocker.title} (${blocker.source})`);
    }
  } else {
    console.log('No blocking checklist item remains for the selected release mode.');
  }

  if (gate.postLaunch.length) {
    console.log('Post-launch automation roadmap in semi_auto mode:');
    for (const task of gate.postLaunch) {
      console.log(`  - ${task.code} ${task.title}`);
    }
  }
}

function printRecommendedNextStep(phase16, phase17, productionEnv, launchStrategy, manualGates) {
  const openCodes = new Set(phase16.open.map((task) => task.code));
  const phase17OpenCodes = new Set(phase17.open.map((task) => task.code));

  if (
    launchStrategy.mode === 'semi_auto' &&
    (!manualGates.telegramPassed || !checklistPassed(manualGates, 'telegram_test'))
  ) {
    console.log(
      '- Telegram is deferred for semi-auto release; keep the Bot Token and Chat ID fields empty for now, then fill them in /system/notifications after deployment.'
    );
  } else if (
    openCodes.has('T1612') ||
    !manualGates.telegramPassed ||
    !checklistPassed(manualGates, 'telegram_test')
  ) {
    console.log(
      '- Configure a real Telegram Bot Token and Chat ID in the notification center, then send a real test message.'
    );
  }

  if (productionEnv.status !== 'passed') {
    console.log(
      '- Set FIRST_RELEASE_MODE in .env.production, fill the real production domain, run npm run prod:env:review && npm run prod:env:check, then record prod_env evidence.'
    );
  } else if (openCodes.has('T1613')) {
    console.log(
      '- Production env check passed; record prod_env evidence with npm run launch:checklist after confirming the reviewed values.'
    );
  }

  if (manualGates.ok && !checklistPassed(manualGates, 'git_baseline')) {
    console.log(
      '- Confirm the Git baseline and record git_baseline evidence in the launch checklist.'
    );
  } else if (!manualGates.ok) {
    console.log(
      '- Manual checklist database was not reachable from this shell; release status used runtime production-env and Git checks instead.'
    );
  }

  if (launchStrategy.mode === 'full_auto' && phase17OpenCodes.size > 0) {
    console.log(
      '- FIRST_RELEASE_MODE=full_auto is selected; complete all remaining Phase 17 automation tasks before launch.'
    );
  }

  if (launchStrategy.mode === 'semi_auto' && phase17OpenCodes.size > 0) {
    console.log(
      '- FIRST_RELEASE_MODE=semi_auto is selected; keep Phase 17 automation tasks as post-launch roadmap unless you require unattended full automation now.'
    );
  }

  console.log(
    '- After manual gates are resolved, run npm run acceptance:launch and npm run git:readiness.'
  );
  console.log('- Commit/push only after explicit approval.');
}

async function main() {
  loadLocalEnv();
  const tasksMarkdown = readText('docs/TASKS.md');
  const rawPhase16 = summarizeTasks(
    'Phase 16 launch preparation',
    parseTasks(extractSection(tasksMarkdown, '## Phase 16 - 上线缺口盘点与发布准备'))
  );
  const phase17 = summarizeTasks(
    'Phase 17 platform automation',
    parseTasks(extractSection(tasksMarkdown, '## Phase 17 - 平台接口与自动化增强'))
  );
  const phase18 = summarizeTasks(
    'Phase 18 ops/security hardening',
    parseTasks(extractSection(tasksMarkdown, '## Phase 18 - 数据、运维和安全增强'))
  );
  const productionEnv = getProductionEnvStatus();
  const launchStrategy = getLaunchStrategy();
  const manualGates = await getManualGateStatus();
  const git = getGitStatus();
  const runtimeResolvedPhase16 = getRuntimeResolvedPhase16Codes(
    productionEnv,
    manualGates,
    launchStrategy
  );
  const phase16 = applyRuntimeResolvedTasks(rawPhase16, runtimeResolvedPhase16);
  const firstReleaseGate = getFirstReleaseGateSummary(
    phase16,
    phase17,
    productionEnv,
    launchStrategy,
    manualGates,
    git
  );

  console.log('Launch status');
  console.log('=============');
  console.log();
  printTaskSummary(phase16);
  console.log();
  printTaskSummary(phase17);
  console.log();
  printTaskSummary(phase18);
  console.log();
  console.log(`First release mode: ${launchStrategy.mode} (${launchStrategy.label})`);
  console.log(`Release mode source: ${launchStrategy.source}${launchStrategy.sourceNote}`);
  console.log(launchStrategy.detail);
  console.log();
  console.log(`Production env: ${productionEnv.status}`);
  console.log(productionEnv.detail);
  console.log(
    `Manual gates source: ${
      manualGates.ok ? 'database' : `unavailable; runtime fallback active (${manualGates.detail})`
    }`
  );
  console.log();
  printFirstReleaseGate(firstReleaseGate);
  console.log();
  console.log(`Git branch: ${git.branch}`);
  console.log(`Git remote: ${git.remote}`);
  console.log(
    `Git changes: ${git.hasChanges ? `${git.changedCount} file(s) pending review` : 'clean'}`
  );
  console.log();
  console.log('Recommended next steps');
  console.log('----------------------');
  printRecommendedNextStep(phase16, phase17, productionEnv, launchStrategy, manualGates);
}

await main();
