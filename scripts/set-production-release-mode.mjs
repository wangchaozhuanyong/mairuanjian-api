#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const defaultEnvFile = process.env.PROD_ENV_FILE ?? '.env.production';
const allowedModes = new Set(['semi_auto', 'full_auto']);

function parseArgs(argv) {
  const args = new Map();
  const flags = new Set();

  for (const arg of argv) {
    if (arg.startsWith('--') && arg.includes('=')) {
      const index = arg.indexOf('=');
      args.set(arg.slice(2, index), arg.slice(index + 1));
      continue;
    }

    if (arg.startsWith('--')) {
      flags.add(arg.slice(2));
      continue;
    }
  }

  return { args, flags };
}

function usage() {
  console.log(`Usage:
  npm run prod:env:set-mode
  npm run prod:env:set-mode -- --mode=semi_auto
  npm run prod:env:set-mode -- --mode=full_auto
  npm run prod:env:set-mode -- --dry-run --mode=semi_auto

Options:
  --mode=MODE      semi_auto or full_auto. Defaults to semi_auto
  --env-file=PATH  Optional env file path. Defaults to PROD_ENV_FILE or .env.production
  --dry-run        Validate and show changed key without writing
`);
}

function normalizeMode(value) {
  const mode = value || 'semi_auto';
  if (!allowedModes.has(mode)) {
    throw new Error('mode must be semi_auto or full_auto');
  }
  return mode;
}

function replaceOrAppendLine(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const suffix = content.endsWith('\n') ? '' : '\n';
  return `${content}${suffix}${line}\n`;
}

function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  if (flags.has('help') || flags.has('h')) {
    usage();
    return;
  }

  const envFile = args.get('env-file') ?? defaultEnvFile;
  const mode = normalizeMode(args.get('mode'));
  const dryRun = flags.has('dry-run');

  if (!existsSync(envFile)) {
    throw new Error(`Missing ${envFile}. Run npm run prod:env:init first.`);
  }

  const original = readFileSync(envFile, 'utf8');
  const next = replaceOrAppendLine(original, 'FIRST_RELEASE_MODE', mode);

  console.log(`Production release mode ${dryRun ? 'validated' : 'applied'} for ${envFile}.`);
  console.log(`FIRST_RELEASE_MODE=${mode}`);

  if (dryRun) {
    console.log('Dry run only. No file was changed.');
    return;
  }

  writeFileSync(envFile, next, { encoding: 'utf8', mode: 0o600 });
  console.log('Only FIRST_RELEASE_MODE was updated. Secrets were not printed.');
  console.log('Run npm run prod:env:review next.');
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Failed to update production release mode'
  );
  console.error('Run npm run prod:env:set-mode -- --help for usage.');
  process.exit(1);
}
