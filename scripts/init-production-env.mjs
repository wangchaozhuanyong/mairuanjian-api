#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const targetPath = '.env.production';
const examplePath = '.env.production.example';

function secret(bytes = 48) {
  return randomBytes(bytes).toString('base64url');
}

function parseArgs(argv) {
  const args = new Map();
  let force = false;

  for (const arg of argv) {
    if (arg === '--force') {
      force = true;
      continue;
    }

    const match = arg.match(/^--([a-z0-9-]+)=(.*)$/i);
    if (match) {
      args.set(match[1], match[2]);
    }
  }

  return { args, force };
}

function replaceLine(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(new RegExp(`^${escapedKey}=.*$`, 'm'), `${key}=${value}`);
}

function main() {
  const { args, force } = parseArgs(process.argv.slice(2));

  if (!existsSync(examplePath)) {
    console.error(`Missing ${examplePath}.`);
    process.exit(1);
  }

  if (existsSync(targetPath) && !force) {
    console.log(`Skipped ${targetPath} because it already exists.`);
    console.log('Use --force only after backing up the current production env file.');
    return;
  }

  const appPublicUrl = args.get('app-url') ?? 'https://example.com';
  const corsOrigin = args.get('cors-origin') ?? appPublicUrl;
  const postgresUser = args.get('postgres-user') ?? 'apple_business';
  const postgresDb = args.get('postgres-db') ?? 'apple_business';
  const adminUsername = args.get('admin-username') ?? 'admin';
  const adminDisplayName = args.get('admin-display-name') ?? '管理员';
  const minioRootUser = args.get('minio-root-user') ?? `minio_${secret(9)}`;

  let content = readFileSync(examplePath, 'utf8');

  content = replaceLine(content, 'APP_PUBLIC_URL', appPublicUrl);
  content = replaceLine(content, 'CORS_ORIGIN', corsOrigin);
  content = replaceLine(content, 'POSTGRES_DB', postgresDb);
  content = replaceLine(content, 'POSTGRES_USER', postgresUser);
  content = replaceLine(content, 'POSTGRES_PASSWORD', secret(36));
  content = replaceLine(content, 'JWT_SECRET', secret(64));
  content = replaceLine(content, 'FIELD_ENCRYPTION_KEY', secret(48));
  content = replaceLine(content, 'HASH_SECRET', secret(64));
  content = replaceLine(content, 'SEED_ADMIN_USERNAME', adminUsername);
  content = replaceLine(content, 'SEED_ADMIN_PASSWORD', secret(30));
  content = replaceLine(content, 'SEED_ADMIN_DISPLAY_NAME', adminDisplayName);
  content = replaceLine(content, 'MINIO_ROOT_USER', minioRootUser);
  content = replaceLine(content, 'MINIO_ROOT_PASSWORD', secret(36));
  content = replaceLine(content, 'MINIO_ACCESS_KEY', minioRootUser);
  content = replaceLine(content, 'MINIO_SECRET_KEY', secret(36));

  writeFileSync(targetPath, content, { encoding: 'utf8', mode: 0o600 });

  console.log(`Created ${targetPath} with generated production secret values.`);
  console.log('Secrets were written to the env file only and were not printed.');
  if (appPublicUrl === 'https://example.com' || corsOrigin === 'https://example.com') {
    console.log('Replace APP_PUBLIC_URL and CORS_ORIGIN with the real production domain.');
  }
  console.log('Run npm run prod:env:check after filling real production values.');
}

main();
