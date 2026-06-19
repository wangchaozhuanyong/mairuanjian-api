#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const defaultEnvFile = process.env.PROD_ENV_FILE ?? '.env.production';

function parseArgs(argv) {
  const args = new Map();
  const flags = new Set();
  const positionals = [];

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

    positionals.push(arg);
  }

  return { args, flags, positionals };
}

function usage() {
  console.log(`Usage:
  npm run prod:env:set-domain -- --app-url=https://admin.example.com
  npm run prod:env:set-domain -- https://admin.example.com
  npm run prod:env:set-domain -- --app-url=https://admin.example.com --cors-origin=https://admin.example.com,https://api.example.com
  npm run prod:env:set-domain -- --dry-run --app-url=https://admin.example.com

Options:
  --app-url=URL       Required unless a positional URL is provided. Must use https://
  --cors-origin=URLS  Optional comma-separated origins. Defaults to app URL
  --env-file=PATH     Optional env file path. Defaults to PROD_ENV_FILE or .env.production
  --dry-run           Validate and show changed keys without writing
`);
}

function normalizeUrl(value, field) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${field} is required`);
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${field} must use https://`);
  }

  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function normalizeCorsOrigins(value, appUrl) {
  const rawOrigins = value?.trim() ? value.split(',') : [appUrl];
  const origins = rawOrigins
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => normalizeUrl(origin, 'cors-origin'));

  if (!origins.length) {
    throw new Error('cors-origin must include at least one URL');
  }

  return [...new Set(origins)].join(',');
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
  const { args, flags, positionals } = parseArgs(process.argv.slice(2));
  if (flags.has('help') || flags.has('h')) {
    usage();
    return;
  }

  const envFile = args.get('env-file') ?? defaultEnvFile;
  const appUrl = normalizeUrl(args.get('app-url') ?? positionals[0], 'app-url');
  const corsOrigin = normalizeCorsOrigins(args.get('cors-origin'), appUrl);
  const dryRun = flags.has('dry-run');

  if (!existsSync(envFile)) {
    throw new Error(`Missing ${envFile}. Run npm run prod:env:init first.`);
  }

  const original = readFileSync(envFile, 'utf8');
  let next = replaceOrAppendLine(original, 'APP_PUBLIC_URL', appUrl);
  next = replaceOrAppendLine(next, 'CORS_ORIGIN', corsOrigin);

  console.log(`Production domain update ${dryRun ? 'validated' : 'applied'} for ${envFile}.`);
  console.log(`APP_PUBLIC_URL=${appUrl}`);
  console.log(`CORS_ORIGIN=${corsOrigin}`);

  if (dryRun) {
    console.log('Dry run only. No file was changed.');
    return;
  }

  writeFileSync(envFile, next, { encoding: 'utf8', mode: 0o600 });
  console.log('Only APP_PUBLIC_URL and CORS_ORIGIN were updated. Secrets were not printed.');
  console.log('Run npm run prod:env:check next.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Failed to update production domain');
  console.error('Run npm run prod:env:set-domain -- --help for usage.');
  process.exit(1);
}
