#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

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
        : 'Semi-auto mode allows Taobao/Xianyu real adapters and Apple ID real worker to ship after first internal launch.'
  };
}

function getFirstReleaseGateSummary(phase16, phase17, productionEnv, launchStrategy) {
  const blockers = [];
  const blockerCodes = new Set();

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

function printRecommendedNextStep(phase16, phase17, productionEnv, launchStrategy) {
  const openCodes = new Set(phase16.open.map((task) => task.code));
  const phase17OpenCodes = new Set(phase17.open.map((task) => task.code));

  if (openCodes.has('T1612')) {
    console.log(
      '- Configure a real Telegram Bot Token and Chat ID in the notification center, then send a real test message.'
    );
  }

  if (openCodes.has('T1613') || productionEnv.status !== 'passed') {
    console.log(
      '- Set FIRST_RELEASE_MODE in .env.production, fill the real production domain, run npm run prod:env:review && npm run prod:env:check, then record prod_env evidence.'
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

function main() {
  const tasksMarkdown = readText('docs/TASKS.md');
  const phase16 = summarizeTasks(
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
  const firstReleaseGate = getFirstReleaseGateSummary(
    phase16,
    phase17,
    productionEnv,
    launchStrategy
  );
  const git = getGitStatus();

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
  printRecommendedNextStep(phase16, phase17, productionEnv, launchStrategy);
}

main();
