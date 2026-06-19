#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const envFile = process.argv[2] ?? process.env.PROD_ENV_FILE ?? '.env.production';
const placeholderPattern = /^(change_me|replace_with)/i;
const weakValuePattern = /(change_me|replace_with|example\.com|localhost|127\.0\.0\.1)/i;
const requiredKeys = [
  'NODE_ENV',
  'APP_PUBLIC_URL',
  'CORS_ORIGIN',
  'FIRST_RELEASE_MODE',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'FIELD_ENCRYPTION_KEY',
  'HASH_SECRET',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET'
];

function parseEnvFile(path) {
  const values = new Map();
  const content = readFileSync(path, 'utf8');

  for (const rawLine of content.split(/\n/)) {
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

function assertUrl(errors, key, value, { requireHttps = true } = {}) {
  try {
    const url = new URL(value);
    if (requireHttps && url.protocol !== 'https:') {
      errors.push(`${key} must use https:// in production`);
    }
  } catch {
    errors.push(`${key} must be a valid URL`);
  }
}

function assertSecret(errors, env, key, minLength) {
  const value = env.get(key) ?? '';

  if (!value) {
    errors.push(`${key} is required`);
    return;
  }

  if (placeholderPattern.test(value) || weakValuePattern.test(value)) {
    errors.push(`${key} contains placeholder or local-only value`);
  }

  if (value.length < minLength) {
    errors.push(`${key} must be at least ${minLength} characters`);
  }
}

function assertOptionalNonNegativeInteger(errors, env, key) {
  const value = env.get(key);
  if (value === undefined || value === '') return;
  if (!/^\d+$/.test(value)) {
    errors.push(`${key} must be a non-negative integer`);
  }
}

function assertOptionalDockerLogSize(errors, env, key) {
  const value = env.get(key);
  if (value === undefined || value === '') return;
  if (!/^\d+(k|m|g)$/i.test(value)) {
    errors.push(`${key} must use Docker size format, for example 20m`);
  }
}

function main() {
  if (!existsSync(envFile)) {
    console.error(
      `Missing ${envFile}. Copy .env.production.example and fill real production values.`
    );
    process.exit(1);
  }

  const env = parseEnvFile(envFile);
  const errors = [];

  for (const key of requiredKeys) {
    if (!env.has(key) || env.get(key) === '') {
      errors.push(`${key} is required`);
    }
  }

  if (env.get('NODE_ENV') !== 'production') {
    errors.push('NODE_ENV must be production');
  }

  if (env.has('FIRST_RELEASE_MODE')) {
    const releaseMode = env.get('FIRST_RELEASE_MODE');
    if (releaseMode !== 'semi_auto' && releaseMode !== 'full_auto') {
      errors.push('FIRST_RELEASE_MODE must be semi_auto or full_auto');
    }
  }

  if (env.has('APP_PUBLIC_URL')) {
    assertUrl(errors, 'APP_PUBLIC_URL', env.get('APP_PUBLIC_URL'));
  }

  if (env.has('CORS_ORIGIN')) {
    for (const origin of env.get('CORS_ORIGIN').split(',')) {
      if (origin.trim()) {
        assertUrl(errors, 'CORS_ORIGIN', origin.trim());
      }
    }
  }

  assertSecret(errors, env, 'POSTGRES_PASSWORD', 16);
  assertSecret(errors, env, 'JWT_SECRET', 32);
  assertSecret(errors, env, 'FIELD_ENCRYPTION_KEY', 32);
  assertSecret(errors, env, 'HASH_SECRET', 32);
  assertSecret(errors, env, 'MINIO_ROOT_PASSWORD', 16);
  assertSecret(errors, env, 'MINIO_SECRET_KEY', 16);

  if (env.has('SEED_ADMIN_PASSWORD') && env.get('SEED_ADMIN_PASSWORD')) {
    assertSecret(errors, env, 'SEED_ADMIN_PASSWORD', 12);
  }

  assertOptionalNonNegativeInteger(errors, env, 'BACKUP_RETENTION_DAYS');
  assertOptionalNonNegativeInteger(errors, env, 'BACKUP_RETENTION_COUNT');
  assertOptionalNonNegativeInteger(errors, env, 'DOCKER_LOG_MAX_FILE');
  assertOptionalDockerLogSize(errors, env, 'DOCKER_LOG_MAX_SIZE');

  for (const [key, value] of env.entries()) {
    if (value && weakValuePattern.test(value)) {
      errors.push(`${key} contains placeholder or local-only value`);
    }
  }

  if (errors.length) {
    console.error(`Production env check failed for ${envFile}:`);
    for (const error of [...new Set(errors)]) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Production env check passed for ${envFile}.`);
}

main();
