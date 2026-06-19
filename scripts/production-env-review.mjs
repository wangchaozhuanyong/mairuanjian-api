#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const envFile = process.argv[2] ?? process.env.PROD_ENV_FILE ?? '.env.production';
const placeholderPattern = /^(change_me|replace_with)/i;
const weakValuePattern = /(change_me|replace_with|example\.com|localhost|127\.0\.0\.1)/i;
const publicKeys = [
  'NODE_ENV',
  'APP_PUBLIC_URL',
  'CORS_ORIGIN',
  'FIRST_RELEASE_MODE',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'MINIO_BUCKET',
  'VITE_APP_TITLE'
];
const secretKeys = new Map([
  ['POSTGRES_PASSWORD', 16],
  ['JWT_SECRET', 32],
  ['FIELD_ENCRYPTION_KEY', 32],
  ['HASH_SECRET', 32],
  ['MINIO_ROOT_USER', 3],
  ['MINIO_ROOT_PASSWORD', 16],
  ['MINIO_ACCESS_KEY', 3],
  ['MINIO_SECRET_KEY', 16],
  ['SEED_ADMIN_PASSWORD', 12],
  ['TAOBAO_APP_SECRET', 1],
  ['XIANYU_APP_SECRET', 1]
]);
const optionalSecretKeys = new Set([
  'SEED_ADMIN_PASSWORD',
  'TAOBAO_APP_SECRET',
  'XIANYU_APP_SECRET'
]);

function parseEnvFile(path) {
  const values = new Map();
  const content = readFileSync(path, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
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

function runValidation() {
  return spawnSync(process.execPath, ['scripts/validate-production-env.mjs', envFile], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function hasWeakValue(value) {
  return placeholderPattern.test(value) || weakValuePattern.test(value);
}

function publicStatus(env, key) {
  const value = env.get(key);
  if (value === undefined || value === '') return { status: 'missing', value: '-' };
  if (hasWeakValue(value)) return { status: 'needs-real-value', value };
  return { status: 'ok', value };
}

function secretStatus(env, key, minLength) {
  const value = env.get(key) ?? '';
  if (!value) {
    return optionalSecretKeys.has(key)
      ? { status: 'not-set-optional', detail: 'optional' }
      : { status: 'missing', detail: `min ${minLength} chars` };
  }

  const issues = [];
  if (hasWeakValue(value)) issues.push('placeholder/local');
  if (value.length < minLength) issues.push(`shorter-than-${minLength}`);

  return {
    status: issues.length ? 'needs-rotation' : 'ok',
    detail: issues.length ? issues.join(', ') : `set, length ${value.length}`
  };
}

function printValidation(result) {
  const passed = result.status === 0;
  console.log(`Validation: ${passed ? 'passed' : 'failed'}`);
  const output = `${result.stderr || result.stdout}`.trim();
  if (!output) return;

  for (const line of output.split(/\r?\n/)) {
    console.log(`  ${line}`);
  }
}

function main() {
  console.log('Production env review');
  console.log('=====================');
  console.log(`File: ${envFile}`);
  console.log('Mode: read-only; secret values are never printed.');
  console.log();

  if (!existsSync(envFile)) {
    console.log(`Status: missing`);
    console.log(`Run npm run prod:env:init, then fill real production values.`);
    process.exitCode = 1;
    return;
  }

  const env = parseEnvFile(envFile);
  const validation = runValidation();
  printValidation(validation);

  console.log();
  console.log('Public values');
  console.log('-------------');
  for (const key of publicKeys) {
    const status = publicStatus(env, key);
    console.log(`${key}: ${status.status} | ${status.value}`);
  }

  console.log();
  console.log('Secret values');
  console.log('-------------');
  for (const [key, minLength] of secretKeys.entries()) {
    const status = secretStatus(env, key, minLength);
    console.log(`${key}: ${status.status} | ${status.detail}`);
  }

  console.log();
  console.log('Next steps');
  console.log('----------');
  if (validation.status === 0) {
    console.log(
      '- Record prod_env evidence with npm run launch:checklist if it is not already passed.'
    );
    console.log(
      '- After all manual gates are passed, run npm run release:ready and REQUIRE_PROD_ENV=1 REQUIRE_MANUAL_GATES=1 npm run acceptance:launch.'
    );
  } else {
    if (!env.get('FIRST_RELEASE_MODE')) {
      console.log('- Set FIRST_RELEASE_MODE with npm run prod:env:set-mode -- --mode=semi_auto.');
    }
    console.log('- Set a real HTTPS APP_PUBLIC_URL and CORS_ORIGIN.');
    console.log('- Replace every placeholder or local-only value before production.');
    console.log('- Re-run npm run prod:env:review and npm run prod:env:check.');
  }
}

main();
