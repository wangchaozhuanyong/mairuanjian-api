type RuntimeEnv = 'development' | 'test' | 'production';

interface RawEnv {
  NODE_ENV?: string;
  APP_PORT?: string;
  CORS_ORIGIN?: string;
  DATABASE_URL?: string;
  FIRST_RELEASE_MODE?: string;
  JWT_SECRET?: string;
  FIELD_ENCRYPTION_KEY?: string;
  HASH_SECRET?: string;
  APPLE_OFFICIAL_PRICE_POLL_ENABLED?: string;
  APPLE_OFFICIAL_PRICE_POLL_INTERVAL_MS?: string;
  APPLE_OFFICIAL_PRICE_POLL_RUN_ON_STARTUP?: string;
  APPLE_OFFICIAL_PRICE_POLL_BOOTSTRAP_PROVIDERS?: string;
  APPLE_WEB_CHECK_WORKER_ENABLED?: string;
  APPLE_WEB_CHECK_WORKER_INTERVAL_MS?: string;
  APPLE_WEB_CHECK_WORKER_RUN_ON_STARTUP?: string;
  APPLE_WEB_CHECK_WORKER_MAX_BATCH?: string;
  APPLE_WEB_CHECK_TIMEOUT_MS?: string;
  APPLE_WEB_CHECK_HEADLESS?: string;
  APPLE_WEB_CHECK_PROXY_SERVER?: string;
  APPLE_WEB_CHECK_SING_BOX_API_URL?: string;
  APPLE_WEB_CHECK_SING_BOX_SELECTOR?: string;
  APPLE_WEB_CHECK_SING_BOX_API_SECRET?: string;
  APPLE_WEB_CHECK_IP_CHECK_URL?: string;
}

function assertUrl(name: string, value: string) {
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function assertNotPlaceholder(name: string, value: string | undefined, env: RuntimeEnv) {
  if (env !== 'production') {
    return;
  }

  if (!value || value.startsWith('change_me') || value.startsWith('replace_with')) {
    throw new Error(`${name} must be configured with a production-safe value`);
  }
}

function assertBooleanString(name: string, value: string | undefined) {
  if (value === undefined || value === '') return;
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${name} must be true or false`);
  }
}

export function validateEnv(config: RawEnv) {
  const nodeEnv = (config.NODE_ENV ?? 'development') as RuntimeEnv;
  const allowedEnvs: RuntimeEnv[] = ['development', 'test', 'production'];

  if (!allowedEnvs.includes(nodeEnv)) {
    throw new Error('NODE_ENV must be one of development, test, production');
  }

  const appPort = Number(config.APP_PORT ?? 3000);
  if (!Number.isInteger(appPort) || appPort <= 0 || appPort > 65535) {
    throw new Error('APP_PORT must be a valid TCP port');
  }

  if (nodeEnv === 'production' && !config.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required in production');
  }

  if (config.CORS_ORIGIN) {
    for (const origin of config.CORS_ORIGIN.split(',').map((item) => item.trim())) {
      if (origin) {
        assertUrl('CORS_ORIGIN', origin);
      }
    }
  }

  if (nodeEnv === 'production' && !config.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }

  if (config.DATABASE_URL && !config.DATABASE_URL.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must use postgresql://');
  }

  if (nodeEnv === 'production' && !config.FIRST_RELEASE_MODE) {
    throw new Error('FIRST_RELEASE_MODE is required in production');
  }

  const firstReleaseMode = config.FIRST_RELEASE_MODE ?? 'semi_auto';
  if (firstReleaseMode !== 'semi_auto' && firstReleaseMode !== 'full_auto') {
    throw new Error('FIRST_RELEASE_MODE must be semi_auto or full_auto');
  }

  assertNotPlaceholder('JWT_SECRET', config.JWT_SECRET, nodeEnv);
  assertNotPlaceholder('FIELD_ENCRYPTION_KEY', config.FIELD_ENCRYPTION_KEY, nodeEnv);
  assertNotPlaceholder('HASH_SECRET', config.HASH_SECRET, nodeEnv);
  assertBooleanString(
    'APPLE_OFFICIAL_PRICE_POLL_ENABLED',
    config.APPLE_OFFICIAL_PRICE_POLL_ENABLED
  );
  assertBooleanString(
    'APPLE_OFFICIAL_PRICE_POLL_RUN_ON_STARTUP',
    config.APPLE_OFFICIAL_PRICE_POLL_RUN_ON_STARTUP
  );
  assertBooleanString(
    'APPLE_OFFICIAL_PRICE_POLL_BOOTSTRAP_PROVIDERS',
    config.APPLE_OFFICIAL_PRICE_POLL_BOOTSTRAP_PROVIDERS
  );
  assertBooleanString('APPLE_WEB_CHECK_WORKER_ENABLED', config.APPLE_WEB_CHECK_WORKER_ENABLED);
  assertBooleanString(
    'APPLE_WEB_CHECK_WORKER_RUN_ON_STARTUP',
    config.APPLE_WEB_CHECK_WORKER_RUN_ON_STARTUP
  );
  assertBooleanString('APPLE_WEB_CHECK_HEADLESS', config.APPLE_WEB_CHECK_HEADLESS);
  if (config.APPLE_WEB_CHECK_SING_BOX_API_URL) {
    assertUrl('APPLE_WEB_CHECK_SING_BOX_API_URL', config.APPLE_WEB_CHECK_SING_BOX_API_URL);
  }
  if (config.APPLE_WEB_CHECK_IP_CHECK_URL) {
    assertUrl('APPLE_WEB_CHECK_IP_CHECK_URL', config.APPLE_WEB_CHECK_IP_CHECK_URL);
  }

  const officialPricePollIntervalMs = Number(
    config.APPLE_OFFICIAL_PRICE_POLL_INTERVAL_MS ?? 21600000
  );
  if (
    !Number.isInteger(officialPricePollIntervalMs) ||
    officialPricePollIntervalMs < 60000 ||
    officialPricePollIntervalMs > 7 * 24 * 60 * 60 * 1000
  ) {
    throw new Error('APPLE_OFFICIAL_PRICE_POLL_INTERVAL_MS must be between 60000 and 604800000');
  }

  const appleWebCheckIntervalMs = Number(config.APPLE_WEB_CHECK_WORKER_INTERVAL_MS ?? 60000);
  if (
    !Number.isInteger(appleWebCheckIntervalMs) ||
    appleWebCheckIntervalMs < 30000 ||
    appleWebCheckIntervalMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error('APPLE_WEB_CHECK_WORKER_INTERVAL_MS must be between 30000 and 86400000');
  }

  const appleWebCheckMaxBatch = Number(config.APPLE_WEB_CHECK_WORKER_MAX_BATCH ?? 3);
  if (
    !Number.isInteger(appleWebCheckMaxBatch) ||
    appleWebCheckMaxBatch <= 0 ||
    appleWebCheckMaxBatch > 20
  ) {
    throw new Error('APPLE_WEB_CHECK_WORKER_MAX_BATCH must be between 1 and 20');
  }

  const appleWebCheckTimeoutMs = Number(config.APPLE_WEB_CHECK_TIMEOUT_MS ?? 45000);
  if (
    !Number.isInteger(appleWebCheckTimeoutMs) ||
    appleWebCheckTimeoutMs < 10000 ||
    appleWebCheckTimeoutMs > 5 * 60 * 1000
  ) {
    throw new Error('APPLE_WEB_CHECK_TIMEOUT_MS must be between 10000 and 300000');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    APP_PORT: String(appPort),
    FIRST_RELEASE_MODE: firstReleaseMode,
    APPLE_OFFICIAL_PRICE_POLL_INTERVAL_MS: String(officialPricePollIntervalMs),
    APPLE_WEB_CHECK_WORKER_INTERVAL_MS: String(appleWebCheckIntervalMs),
    APPLE_WEB_CHECK_WORKER_MAX_BATCH: String(appleWebCheckMaxBatch),
    APPLE_WEB_CHECK_TIMEOUT_MS: String(appleWebCheckTimeoutMs)
  };
}
