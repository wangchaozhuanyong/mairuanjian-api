#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  cleanupDevelopmentData,
  summarizeDevelopmentDataCounts
} from './lib/development-data-cleanup.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

function parseEnvFile(path) {
  if (!existsSync(path)) return new Map();

  const values = new Map();
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
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

function loadDotEnv() {
  for (const [key, value] of parseEnvFile('.env')) {
    process.env[key] ??= value;
  }
}

function parseArgs(argv) {
  const args = {
    yes: false,
    dryRun: false,
    deleteLocalBackups: false,
    resetLaunchChecklist: true,
    allowProduction: false,
    allowRemote: false,
    databaseUrl: ''
  };

  for (const arg of argv) {
    if (arg === '--yes') {
      args.yes = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--delete-local-backups') {
      args.deleteLocalBackups = true;
      continue;
    }
    if (arg === '--keep-launch-checklist') {
      args.resetLaunchChecklist = false;
      continue;
    }
    if (arg === '--allow-production') {
      args.allowProduction = true;
      continue;
    }
    if (arg === '--allow-remote') {
      args.allowRemote = true;
      continue;
    }
    if (arg.startsWith('--database-url=')) {
      args.databaseUrl = arg.slice('--database-url='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  npm run clean:dev-data -- --dry-run
  npm run clean:dev-data -- --yes
  npm run clean:dev-data -- --yes --delete-local-backups
  npm run clean:dev-data -- --yes --database-url=postgresql://postgres:postgres@localhost:55432/apple_business

What it removes:
  - local acceptance/demo business records
  - local operational logs and temporary acceptance users
  - optional local PostgreSQL dump files under backups/postgres/local

What it keeps:
  - roles, permissions and admin user
  - seed defaults such as notification rules, system parameters, dictionaries and feature flags
`);
}

function assertSafeEnvironment(args) {
  const databaseUrl = args.databaseUrl || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing.');
  }

  const url = new URL(databaseUrl);
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

  if (process.env.NODE_ENV === 'production' && !args.allowProduction) {
    throw new Error(
      'Refusing to clean data with NODE_ENV=production. Pass --allow-production only after an explicit production data-cleaning approval.'
    );
  }

  if (!isLocalDatabase && !args.allowRemote) {
    throw new Error(
      `Refusing to clean remote database ${url.hostname}. Pass --allow-remote only after confirming this is the target database.`
    );
  }

  if (!args.dryRun && !args.yes) {
    throw new Error('Refusing to delete data without --yes. Use --dry-run to preview first.');
  }
}

function printDatabaseTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  console.log(
    `Database target: ${url.protocol}//${url.username || '<no-user>'}:***@${url.hostname}${
      url.port ? `:${url.port}` : ''
    }${url.pathname}`
  );
}

function printSummary(label, counts) {
  const summary = summarizeDevelopmentDataCounts(counts);
  console.log(`${label}: ${summary.totalRows} rows`);
  if (summary.devUsers > 0) {
    console.log(`  dev users: ${summary.devUsers}`);
  }

  for (const [table, count] of summary.nonEmptyTables) {
    console.log(`  ${table}: ${count}`);
  }
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  assertSafeEnvironment(args);
  if (args.databaseUrl) {
    process.env.DATABASE_URL = args.databaseUrl;
  }
  printDatabaseTarget(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    const result = await cleanupDevelopmentData(prisma, {
      dryRun: args.dryRun,
      resetLaunchChecklist: args.resetLaunchChecklist,
      deleteLocalBackups: args.deleteLocalBackups
    });

    printSummary('Before cleanup', result.before);
    if (args.dryRun) {
      console.log('Dry run only. No data was deleted.');
      return;
    }

    printSummary('After cleanup', result.after);
    if (result.deletedBackupFiles.length) {
      console.log('Deleted local backup files:');
      for (const file of result.deletedBackupFiles) {
        console.log(`  ${file}`);
      }
    }
    console.log('Development data cleanup completed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
