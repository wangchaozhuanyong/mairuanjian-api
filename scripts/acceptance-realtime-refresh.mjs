import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const publishCheck = process.argv.includes('--publish-check');

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

function loadCredentials() {
  const env = {
    ...readEnvFile(path.join(rootDir, '.env')),
    ...readEnvFile(path.join(rootDir, 'apps/api/.env')),
    ...process.env
  };

  const username = env.REALTIME_ACCEPTANCE_USERNAME ?? env.SEED_ADMIN_USERNAME;
  const password = env.REALTIME_ACCEPTANCE_PASSWORD ?? env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing REALTIME_ACCEPTANCE_USERNAME/REALTIME_ACCEPTANCE_PASSWORD or SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD.'
    );
  }

  return { username, password };
}

async function unwrap(response, label) {
  const text = await response.text();
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
      // Ignore malformed partial chunks; the next read will carry the remainder.
    }
  }

  return { events, rest };
}

async function login() {
  const { username, password } = loadCredentials();
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const json = await unwrap(response, 'POST /auth/login');
  const token = json.data?.accessToken;

  if (!token) {
    throw new Error('Login succeeded but access token is missing.');
  }

  return token;
}

async function collectRealtimeEvents(token, expectedCount) {
  const controller = new AbortController();
  const eventTypes = [];
  let rest = '';

  const collect = (async () => {
    const response = await fetch(
      `${API_BASE_URL}/realtime/events?accessToken=${encodeURIComponent(token)}`,
      {
        signal: controller.signal,
        headers: { accept: 'text/event-stream' }
      }
    );

    if (!response.ok) {
      throw new Error(`GET /realtime/events failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (eventTypes.length < expectedCount) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      rest += decoder.decode(value, { stream: true });
      const parsed = parseSseEvents(rest);
      rest = parsed.rest;

      for (const event of parsed.events) {
        if (event?.type) {
          eventTypes.push(event.type);
        }
      }
    }
  })();

  return {
    eventTypes,
    stop: () => controller.abort(),
    wait: () =>
      Promise.race([
        collect,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timed out waiting for realtime events.')), 10_000)
        )
      ])
  };
}

async function main() {
  const token = await login();
  const expectedCount = publishCheck ? 2 : 1;
  const collector = await collectRealtimeEvents(token, expectedCount);

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (publishCheck) {
      await unwrap(
        await fetch(`${API_BASE_URL}/ops/health-snapshots`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` }
        }),
        'POST /ops/health-snapshots'
      );
    }

    await collector.wait();
  } finally {
    collector.stop();
  }

  if (!collector.eventTypes.includes('system.connected')) {
    throw new Error('SSE connected event was not received.');
  }

  if (publishCheck && !collector.eventTypes.includes('ops.health.updated')) {
    throw new Error('Realtime publish check event was not received.');
  }

  console.log(
    JSON.stringify(
      {
        login: 'ok',
        sseConnected: true,
        publishCheck,
        receivedEventTypes: collector.eventTypes
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
