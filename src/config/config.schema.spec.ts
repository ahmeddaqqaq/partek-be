import { validateEnv } from './config.schema';

const valid = {
  NODE_ENV: 'development',
  PORT: '3000',
  CORS_ORIGINS: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://partek:partek@localhost:5434/partek',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: '12',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  STORAGE_DRIVER: 'stub',
  S3_BUCKET: 'partek-dev',
  S3_REGION: 'me-south-1',
  VAT_RATE: '0.15',
  DEFAULT_PLATFORM_FEE_PCT: '5',
  CART_PRICE_LOCK_HOURS: '48',
};

describe('validateEnv', () => {
  it('parses a complete environment into typed config', () => {
    const config = validateEnv(valid);
    expect(config.port).toBe(3000);
    expect(config.jwt.accessSecret).toHaveLength(32);
    expect(config.vatRate).toBe(0.15);
    expect(config.cartPriceLockHours).toBe(48);
    expect(config.corsOrigins).toEqual(['http://localhost:3001']);
  });

  it('throws naming every missing variable at once', () => {
    const { JWT_ACCESS_SECRET, DATABASE_URL, ...rest } = valid;
    void JWT_ACCESS_SECRET;
    void DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
    expect(() => validateEnv(rest)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects the .env.example placeholder secrets despite their length', () => {
    // These are the literal values shipped in .env.example. Both are longer
    // than 32 characters, so a length check alone lets them through.
    expect(() =>
      validateEnv({
        ...valid,
        JWT_ACCESS_SECRET: 'replace-me-access-secret-do-not-ship',
      }),
    ).toThrow(/JWT_ACCESS_SECRET still holds a placeholder/);

    expect(() =>
      validateEnv({
        ...valid,
        JWT_REFRESH_SECRET: 'replace-me-refresh-secret-do-not-ship',
      }),
    ).toThrow(/JWT_REFRESH_SECRET still holds a placeholder/);
  });

  it('accepts a real generated secret of the same length', () => {
    const real = 'f3a9c1e07b52d84f6a0c93be175d2408';
    expect(real.length).toBe(32);
    expect(() =>
      validateEnv({ ...valid, JWT_ACCESS_SECRET: real, JWT_REFRESH_SECRET: real }),
    ).not.toThrow();
  });

  it('rejects a non-numeric port', () => {
    expect(() => validateEnv({ ...valid, PORT: 'not-a-number' })).toThrow(/PORT/);
  });

  it('rejects a VAT rate outside 0..1', () => {
    expect(() => validateEnv({ ...valid, VAT_RATE: '15' })).toThrow(/VAT_RATE/);
  });
});
