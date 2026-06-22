import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const DEFAULT_ADMIN_BASE_URL = 'http://localhost:5374';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';
const FRONTEND_WARN_MS = Number(process.env.LOADING_ACCEPTANCE_FRONTEND_WARN_MS ?? 1200);
const API_WARN_MS = Number(process.env.LOADING_ACCEPTANCE_API_WARN_MS ?? 1800);
const REQUEST_TIMEOUT_MS = Number(process.env.LOADING_ACCEPTANCE_TIMEOUT_MS ?? 8000);

const frontendRoutes = [
  '/',
  '/dashboard',
  '/apple/accounts',
  '/workspace/renewal',
  '/codes/inventory',
  '/codes/orders',
  '/system/notifications'
];

const apiChecks = [
  { label: 'current user', path: '/auth/me' },
  { label: 'navigation badges', path: '/notifications/nav-badges' },
  { label: 'dashboard apple accounts', path: '/apple/accounts?page=1&pageSize=20' },
  { label: 'renewal tasks', path: '/apple/renewal-tasks?page=1&pageSize=20' },
  { label: 'code inventory', path: '/codes/inventory?page=1&pageSize=20' },
  { label: 'code orders', path: '/codes/orders?page=1&pageSize=20' },
  { label: 'customers', path: '/customers?page=1&pageSize=20' }
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const text = fs.readFileSync(filePath, 'utf8');

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index < 0) {
      continue;
    }

    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }

  return env;
}

function loadEnv() {
  return {
    ...readEnvFile(path.join(rootDir, '.env')),
    ...readEnvFile(path.join(rootDir, 'apps/api/.env')),
    ...readEnvFile(path.join(rootDir, 'apps/admin/.env')),
    ...process.env
  };
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/$/, '');
}

function resolveUrl(baseUrl, target) {
  return `${trimTrailingSlash(baseUrl)}/${String(target).replace(/^\/+/, '')}`;
}

function getConfig() {
  const env = loadEnv();
  return {
    adminBaseUrl: trimTrailingSlash(env.ADMIN_BASE_URL ?? DEFAULT_ADMIN_BASE_URL),
    apiBaseUrl: trimTrailingSlash(
      env.API_BASE_URL ?? env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL
    ),
    username:
      env.LOADING_ACCEPTANCE_USERNAME ?? env.NAV_ACCEPTANCE_USERNAME ?? env.SEED_ADMIN_USERNAME,
    password:
      env.LOADING_ACCEPTANCE_PASSWORD ?? env.NAV_ACCEPTANCE_PASSWORD ?? env.SEED_ADMIN_PASSWORD
  };
}

async function timedFetch(url, options = {}) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal
    });
    const durationMs = Math.round(performance.now() - startedAt);
    return { response, durationMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function readText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function login(apiBaseUrl, username, password) {
  if (!username || !password) {
    return null;
  }

  const { response } = await timedFetch(resolveUrl(apiBaseUrl, '/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const text = await readText(response);
  const json = text ? JSON.parse(text) : null;

  if (!response.ok || !json?.data?.accessToken) {
    throw new Error(`login failed: ${response.status} ${json?.message ?? text.slice(0, 120)}`);
  }

  return json.data.accessToken;
}

function extractAssets(html) {
  const assets = new Set();
  const assetPattern = /(?:src|href)="([^"]+)"/g;
  let match;

  while ((match = assetPattern.exec(html))) {
    const asset = match[1];
    if (asset.startsWith('/assets/') || asset.startsWith('/@vite/') || asset.startsWith('/src/')) {
      assets.add(asset);
    }
  }

  return Array.from(assets);
}

function summarizeCheck(label, durationMs, ok, warnMs, extra = {}) {
  return {
    label,
    ok,
    durationMs,
    warning: durationMs > warnMs,
    ...extra
  };
}

async function checkFrontend(adminBaseUrl) {
  const routes = [];
  let rootHtml = '';

  for (const route of frontendRoutes) {
    const { response, durationMs } = await timedFetch(resolveUrl(adminBaseUrl, route), {
      headers: { accept: 'text/html' }
    });
    const html = await readText(response);
    const ok = response.ok && html.includes('id="app"');

    if (route === '/') {
      rootHtml = html;
    }

    routes.push(
      summarizeCheck(route, durationMs, ok, FRONTEND_WARN_MS, {
        cacheControl: response.headers.get('cache-control') ?? ''
      })
    );
  }

  const assets = [];
  for (const asset of extractAssets(rootHtml).slice(0, 12)) {
    const { response, durationMs } = await timedFetch(resolveUrl(adminBaseUrl, asset), {
      headers: { accept: '*/*', 'accept-encoding': 'gzip, br' }
    });
    assets.push(
      summarizeCheck(asset, durationMs, response.ok, FRONTEND_WARN_MS, {
        cacheControl: response.headers.get('cache-control') ?? '',
        contentEncoding: response.headers.get('content-encoding') ?? '',
        contentLength: response.headers.get('content-length') ?? ''
      })
    );
  }

  return { routes, assets };
}

async function checkApi(apiBaseUrl, token) {
  if (!token) {
    return {
      skipped: true,
      reason: 'missing acceptance credentials'
    };
  }

  const checks = [];
  for (const check of apiChecks) {
    const { response, durationMs } = await timedFetch(resolveUrl(apiBaseUrl, check.path), {
      headers: { authorization: `Bearer ${token}` }
    });
    checks.push(
      summarizeCheck(check.label, durationMs, response.ok, API_WARN_MS, {
        status: response.status
      })
    );
    await response.body?.cancel();
  }

  return { skipped: false, checks };
}

async function main() {
  const config = getConfig();
  let token = null;
  let apiLoginError = '';

  try {
    token = await login(config.apiBaseUrl, config.username, config.password);
  } catch (error) {
    apiLoginError = error instanceof Error ? error.message : String(error);
  }

  const frontend = await checkFrontend(config.adminBaseUrl);
  const api = apiLoginError
    ? {
        skipped: true,
        reason: apiLoginError
      }
    : await checkApi(config.apiBaseUrl, token);

  const failedFrontend = [...frontend.routes, ...frontend.assets].filter((item) => !item.ok);
  const failedApi = api.skipped ? [] : api.checks.filter((item) => !item.ok);
  const warnings = [
    ...frontend.routes,
    ...frontend.assets,
    ...(api.skipped ? [] : api.checks)
  ].filter((item) => item.warning);

  console.log(
    JSON.stringify(
      {
        adminBaseUrl: config.adminBaseUrl,
        apiBaseUrl: config.apiBaseUrl,
        frontend,
        api,
        summary: {
          ok: failedFrontend.length === 0 && failedApi.length === 0 && !apiLoginError,
          failed: [
            ...failedFrontend.map((item) => item.label),
            ...failedApi.map((item) => item.label),
            ...(apiLoginError ? ['api login/connectivity'] : [])
          ],
          warnings: warnings.map((item) => `${item.label}:${item.durationMs}ms`)
        }
      },
      null,
      2
    )
  );

  if (failedFrontend.length || failedApi.length || apiLoginError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
