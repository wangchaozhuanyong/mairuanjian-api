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
  PLATFORM_POLL_ENABLED?: string;
  PLATFORM_POLL_INTERVAL_MS?: string;
  PLATFORM_POLL_RUN_ON_STARTUP?: string;
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
  assertBooleanString('PLATFORM_POLL_ENABLED', config.PLATFORM_POLL_ENABLED);
  assertBooleanString('PLATFORM_POLL_RUN_ON_STARTUP', config.PLATFORM_POLL_RUN_ON_STARTUP);

  const platformPollIntervalMs = Number(config.PLATFORM_POLL_INTERVAL_MS ?? 300000);
  if (
    !Number.isInteger(platformPollIntervalMs) ||
    platformPollIntervalMs < 60000 ||
    platformPollIntervalMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error('PLATFORM_POLL_INTERVAL_MS must be between 60000 and 86400000');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    APP_PORT: String(appPort),
    FIRST_RELEASE_MODE: firstReleaseMode,
    PLATFORM_POLL_INTERVAL_MS: String(platformPollIntervalMs)
  };
}
