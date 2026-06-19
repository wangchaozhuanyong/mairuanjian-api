import { validateEnv } from './env.validation';

const productionSafeEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/apple_business',
  JWT_SECRET: 'production-jwt-secret',
  FIELD_ENCRYPTION_KEY: 'production-field-encryption-key',
  HASH_SECRET: 'production-hash-secret',
  FIRST_RELEASE_MODE: 'semi_auto'
};

describe('validateEnv', () => {
  it('defaults FIRST_RELEASE_MODE to semi_auto outside production', () => {
    expect(validateEnv({ NODE_ENV: 'development' }).FIRST_RELEASE_MODE).toBe('semi_auto');
  });

  it('requires FIRST_RELEASE_MODE in production', () => {
    const env: Record<string, string> = { ...productionSafeEnv };
    delete env.FIRST_RELEASE_MODE;

    expect(() => validateEnv(env)).toThrow('FIRST_RELEASE_MODE is required in production');
  });

  it('rejects an invalid FIRST_RELEASE_MODE', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: productionSafeEnv.DATABASE_URL,
        JWT_SECRET: productionSafeEnv.JWT_SECRET,
        FIELD_ENCRYPTION_KEY: productionSafeEnv.FIELD_ENCRYPTION_KEY,
        HASH_SECRET: productionSafeEnv.HASH_SECRET,
        FIRST_RELEASE_MODE: 'manual'
      })
    ).toThrow('FIRST_RELEASE_MODE must be semi_auto or full_auto');
  });

  it('accepts explicit semi_auto release mode in production', () => {
    expect(validateEnv(productionSafeEnv).FIRST_RELEASE_MODE).toBe('semi_auto');
  });
});
