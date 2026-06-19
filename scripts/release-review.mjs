#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

const strict = process.argv.includes('--strict');

const checks = [
  {
    title: 'Launch Status',
    command: process.execPath,
    args: ['scripts/launch-status.mjs'],
    required: true
  },
  {
    title: 'Manual Gates',
    command: process.execPath,
    args: ['scripts/manual-gates-status.mjs', ...(strict ? ['--strict'] : [])],
    required: true
  },
  ...(strict
    ? [
        {
          title: 'Production Env Check',
          command: process.execPath,
          args: ['scripts/validate-production-env.mjs'],
          required: true
        },
        {
          title: 'Production Env Review Details',
          command: process.execPath,
          args: ['scripts/production-env-review.mjs'],
          required: false
        }
      ]
    : [
        {
          title: 'Production Env Review',
          command: process.execPath,
          args: ['scripts/production-env-review.mjs'],
          required: true
        }
      ]),
  {
    title: 'Manual Checklist Items',
    command: process.execPath,
    args: ['scripts/record-launch-checklist.mjs', '--list'],
    required: true
  },
  {
    title: 'Git Readiness Verbose',
    command: process.execPath,
    args: ['scripts/git-readiness.mjs', '--verbose'],
    required: true
  }
];

function printHeader() {
  console.log(strict ? 'First release readiness' : 'First release review');
  console.log(strict ? '=======================' : '====================');
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(`Mode: ${strict ? 'strict readiness gate' : 'read-only review'}.`);
  console.log('No files, database rows, notifications, commits, or pushes are changed.');
  console.log();
  console.log('Reference docs:');
  console.log('- docs/FIRST_RELEASE_HANDOFF.md');
  console.log('- docs/ROADMAP_TO_LAUNCH.md');
  console.log('- docs/DEPLOYMENT.md');
  console.log();
}

function runCheck(check) {
  console.log();
  console.log(`== ${check.title} ==`);
  const result = spawnSync(check.command, check.args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.stdout.trim()) {
    console.log(result.stdout.trimEnd());
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trimEnd());
  }

  if (result.error) {
    console.error(result.error.message);
    return false;
  }

  if (result.status !== 0) {
    console.error(`${check.title} exited with code ${result.status}.`);
    return !check.required;
  }

  return true;
}

function printFooter(ok) {
  console.log();
  console.log('Review summary');
  console.log('--------------');
  if (!ok) {
    console.log(
      strict
        ? 'Release is not ready. Resolve the failed gates above before production.'
        : 'Release review failed before all required sections completed.'
    );
    return;
  }

  if (strict) {
    console.log('Release readiness gate passed.');
    console.log('Production release can continue to the deployment and smoke-test steps.');
  } else {
    console.log('Release review command completed.');
    console.log('This does not mean production is ready if Manual Gates still says blocked.');
    console.log('Before production, resolve Telegram, production domain, and Git baseline gates.');
  }
}

function main() {
  printHeader();
  const results = checks.map(runCheck);
  const ok = results.every(Boolean);
  printFooter(ok);
  if (!ok) process.exitCode = 1;
}

main();
