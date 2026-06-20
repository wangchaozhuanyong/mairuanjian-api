import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const DEFAULT_ADMIN_BASE_URL = 'http://localhost:5374';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';
const FRONTEND_ROUTE_WARN_MS = Number(process.env.NAV_ACCEPTANCE_FRONTEND_WARN_MS ?? 1200);
const API_WARN_MS = Number(process.env.NAV_ACCEPTANCE_API_WARN_MS ?? 1800);
const REQUEST_TIMEOUT_MS = Number(process.env.NAV_ACCEPTANCE_REQUEST_TIMEOUT_MS ?? 8000);
const SSE_TIMEOUT_MS = Number(process.env.NAV_ACCEPTANCE_SSE_TIMEOUT_MS ?? 10_000);

const frontendRoutes = [
  '/',
  '/dashboard',
  '/workspace/renewal',
  '/apple/accounts',
  '/apple/orders',
  '/codes/inventory',
  '/codes/orders',
  '/system/notifications',
  '/system/security',
  '/system/data-center',
  '/system/ops-monitor',
  '/system/platform-status'
];

const apiChecks = [
  { label: 'current user', path: '/auth/me' },
  { label: 'navigation badges', path: '/notifications/nav-badges' },
  { label: 'navigation item badges', path: '/notifications/nav-item-badges' },
  { label: 'notification overview', path: '/notifications/overview' },
  { label: 'ops overview', path: '/ops/overview' },
  { label: 'platform status', path: '/ops/platforms' },
  { label: 'apple accounts', path: '/apple/accounts?page=1&pageSize=5' },
  { label: 'apple renewal tasks', path: '/apple/renewal-tasks?page=1&pageSize=5' },
  { label: 'apple action plans', path: '/apple/action-plans?page=1&pageSize=5' },
  { label: 'code inventory', path: '/codes/inventory?page=1&pageSize=5' },
  { label: 'code orders', path: '/codes/orders?page=1&pageSize=5' },
  { label: 'customers', path: '/customers?page=1&pageSize=5' },
  { label: 'data overview', path: '/data/overview' },
  { label: 'maintenance overview', path: '/maintenance/overview' },
  { label: 'security overview', path: '/security/overview' },
  { label: 'audit operation logs', path: '/audit-logs/operation?page=1&pageSize=5' }
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

function getConfig() {
  const env = loadEnv();
  const adminBaseUrl = trimTrailingSlash(env.ADMIN_BASE_URL ?? DEFAULT_ADMIN_BASE_URL);
  const apiBaseUrl = trimTrailingSlash(
    env.API_BASE_URL ?? env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL
  );
  const username =
    env.NAV_ACCEPTANCE_USERNAME ?? env.REALTIME_ACCEPTANCE_USERNAME ?? env.SEED_ADMIN_USERNAME;
  const password =
    env.NAV_ACCEPTANCE_PASSWORD ?? env.REALTIME_ACCEPTANCE_PASSWORD ?? env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing NAV_ACCEPTANCE_USERNAME/NAV_ACCEPTANCE_PASSWORD or SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD.'
    );
  }

  return {
    adminBaseUrl,
    apiBaseUrl,
    username,
    password
  };
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/$/, '');
}

async function timedFetch(url, options = {}) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal
    });
    const durationMs = Math.round(performance.now() - startedAt);
    return { response, durationMs };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `request timed out after ${durationMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);

    throw new Error(`${options.method ?? 'GET'} ${url} failed: ${message}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function unwrapJson(response, label) {
  const text = await readResponseText(response);
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${json?.message ?? text.slice(0, 120)}`);
  }

  return json;
}

function resolveUrl(baseUrl, target) {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const normalizedTarget = String(target).replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedTarget}`;
}

function extractInitialAssets(html) {
  const assets = new Set();
  const assetPattern = /(?:src|href)="([^"]+)"/g;
  let match;

  while ((match = assetPattern.exec(html))) {
    const asset = match[1];
    if (
      asset.startsWith('/src/') ||
      asset.startsWith('/assets/') ||
      asset.endsWith('.js') ||
      asset.endsWith('.css') ||
      asset.includes('/@vite/client')
    ) {
      assets.add(asset);
    }
  }

  return Array.from(assets);
}

async function login(apiBaseUrl, username, password) {
  const { response } = await timedFetch(resolveUrl(apiBaseUrl, 'auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const json = await unwrapJson(response, 'POST /auth/login');
  const token = json.data?.accessToken;

  if (!token) {
    throw new Error('Login succeeded but access token is missing.');
  }

  return token;
}

async function checkFrontendRoutes(adminBaseUrl) {
  const checks = [];
  let rootHtml = '';

  for (const route of frontendRoutes) {
    const { response, durationMs } = await timedFetch(resolveUrl(adminBaseUrl, route), {
      headers: {
        accept: 'text/html'
      }
    });
    const html = await readResponseText(response);
    const ok = response.ok && html.includes('id="app"');

    if (route === '/') {
      rootHtml = html;
    }

    checks.push({
      route,
      status: response.status,
      durationMs,
      ok,
      warning: durationMs > FRONTEND_ROUTE_WARN_MS ? `route over ${FRONTEND_ROUTE_WARN_MS}ms` : ''
    });

    if (!ok) {
      throw new Error(`Frontend route ${route} failed: ${response.status}`);
    }
  }

  return {
    checks,
    assets: extractInitialAssets(rootHtml)
  };
}

async function checkInitialAssets(adminBaseUrl, assets) {
  const checks = [];

  for (const asset of assets.slice(0, 12)) {
    const { response, durationMs } = await timedFetch(resolveUrl(adminBaseUrl, asset));
    checks.push({
      asset,
      status: response.status,
      durationMs,
      ok: response.ok
    });

    if (!response.ok) {
      throw new Error(`Frontend asset ${asset} failed: ${response.status}`);
    }
  }

  return checks;
}

async function checkApi(apiBaseUrl, token) {
  const checks = [];

  for (const item of apiChecks) {
    const { response, durationMs } = await timedFetch(resolveUrl(apiBaseUrl, item.path), {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const json = await unwrapJson(response, `GET ${item.path}`);

    checks.push({
      label: item.label,
      path: item.path,
      status: response.status,
      durationMs,
      success: json.success === true,
      warning: durationMs > API_WARN_MS ? `api over ${API_WARN_MS}ms` : ''
    });

    if (json.success !== true) {
      throw new Error(`GET ${item.path} returned an unsuccessful API body.`);
    }
  }

  return checks;
}

function parseSseEvents(buffer) {
  const events = [];
  const blocks = buffer.split(/\n\n/);
  const rest = blocks.pop() ?? '';

  for (const block of blocks) {
    const dataLine = block.split(/\n/).find((line) => line.startsWith('data:'));
    if (!dataLine) {
      continue;
    }

    try {
      events.push(JSON.parse(dataLine.slice(5).trim()));
    } catch {
      // Ignore incomplete chunks.
    }
  }

  return { events, rest };
}

async function checkSse(apiBaseUrl, token) {
  const controller = new AbortController();
  const response = await fetch(
    `${resolveUrl(apiBaseUrl, 'realtime/events')}?accessToken=${encodeURIComponent(token)}`,
    {
      signal: controller.signal,
      headers: {
        accept: 'text/event-stream'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GET /realtime/events failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let rest = '';

  const startedAt = performance.now();

  try {
    while (performance.now() - startedAt < SSE_TIMEOUT_MS) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ done: true }), SSE_TIMEOUT_MS))
      ]);

      if (done) {
        break;
      }

      rest += decoder.decode(value, { stream: true });
      const parsed = parseSseEvents(rest);
      rest = parsed.rest;
      events.push(...parsed.events);

      if (events.some((event) => event?.type === 'system.connected')) {
        return {
          connected: true,
          durationMs: Math.round(performance.now() - startedAt),
          receivedEventTypes: events.map((event) => event.type).filter(Boolean)
        };
      }
    }
  } finally {
    controller.abort();
  }

  throw new Error('Timed out waiting for SSE system.connected event.');
}

function summarizeWarnings(frontendChecks, apiResults) {
  return [
    ...frontendChecks.filter((item) => item.warning),
    ...apiResults.filter((item) => item.warning)
  ];
}

async function main() {
  const config = getConfig();
  const frontend = await checkFrontendRoutes(config.adminBaseUrl);
  const assetChecks = await checkInitialAssets(config.adminBaseUrl, frontend.assets);
  const token = await login(config.apiBaseUrl, config.username, config.password);
  const apiResults = await checkApi(config.apiBaseUrl, token);
  const sse = await checkSse(config.apiBaseUrl, token);
  const warnings = summarizeWarnings(frontend.checks, apiResults);

  console.log(
    JSON.stringify(
      {
        adminBaseUrl: config.adminBaseUrl,
        apiBaseUrl: config.apiBaseUrl,
        frontendRoutes: frontend.checks,
        initialAssets: assetChecks,
        apiChecks: apiResults,
        sse,
        warnings,
        summary: {
          frontendRouteCount: frontend.checks.length,
          assetCount: assetChecks.length,
          apiCheckCount: apiResults.length,
          warningCount: warnings.length
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
