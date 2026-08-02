## Task 9: Typed config with fail-fast validation

**Files:**
- Modify: `src/config/configuration.ts`
- Create: `src/config/config.schema.ts`
- Create: `src/config/config.schema.spec.ts`

**Interfaces:**
- Consumes: the `.env` contract from Task 2.
- Produces: `validateEnv(raw: Record<string, unknown>): AppConfig` and the `AppConfig` type. Every later task reads settings via `ConfigService<AppConfig, true>` and the dotted keys below — never `process.env` directly.

An app that boots with a missing `JWT_REFRESH_SECRET` and only fails when someone tries to log out is worse than one that refuses to start. Validation runs at bootstrap.

- [ ] **Step 1: Write the failing test**

Create `src/config/config.schema.spec.ts`:

```ts
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
    expect(
      () =>
        validateEnv({
          ...valid,
          JWT_ACCESS_SECRET: 'replace-me-access-secret-do-not-ship',
        }),
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/config/config.schema.spec.ts`
Expected: FAIL — `Cannot find module './config.schema'`.

- [ ] **Step 3: Write `src/config/config.schema.ts`**

```ts
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  database: { url: string };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  bcryptRounds: number;
  redis: { host: string; port: number };
  storage: {
    driver: 'stub' | 's3';
    bucket: string;
    region: string;
    endpoint?: string;
  };
  vatRate: number;
  defaultPlatformFeePct: number;
  cartPriceLockHours: number;
}

/**
 * Values that must never reach a running instance. `.env.example` ships
 * secrets long enough to satisfy a minimum-length check, so length alone
 * would let a copied-and-unedited .env boot with a signing key published in
 * the repository.
 */
const PLACEHOLDER_PATTERN = /replace-me|change-me|do-not-ship|your-secret|example|changeme/i;

class EnvReader {
  readonly errors: string[] = [];

  constructor(private readonly raw: Record<string, unknown>) {}

  private get(key: string): string | undefined {
    const value = this.raw[key];
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
  }

  str(
    key: string,
    opts: { minLength?: number; notPlaceholder?: boolean } = {},
  ): string {
    const value = this.get(key);
    if (value === undefined) {
      this.errors.push(`${key} is required`);
      return '';
    }
    if (opts.minLength && value.length < opts.minLength) {
      this.errors.push(
        `${key} must be at least ${opts.minLength} characters (got ${value.length})`,
      );
    }
    // A length check alone does not catch a copied .env.example: the shipped
    // placeholders are long enough to pass one.
    if (opts.notPlaceholder && PLACEHOLDER_PATTERN.test(value)) {
      this.errors.push(
        `${key} still holds a placeholder value from .env.example. ` +
          'Generate a real secret with: openssl rand -hex 32',
      );
    }
    return value;
  }

  optionalStr(key: string): string | undefined {
    return this.get(key);
  }

  num(key: string, opts: { min?: number; max?: number } = {}): number {
    const value = this.get(key);
    if (value === undefined) {
      this.errors.push(`${key} is required`);
      return 0;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      this.errors.push(`${key} must be a number (got "${value}")`);
      return 0;
    }
    if (opts.min !== undefined && parsed < opts.min) {
      this.errors.push(`${key} must be >= ${opts.min} (got ${parsed})`);
    }
    if (opts.max !== undefined && parsed > opts.max) {
      this.errors.push(`${key} must be <= ${opts.max} (got ${parsed})`);
    }
    return parsed;
  }

  enum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const value = this.get(key);
    if (value === undefined) return fallback;
    if (!allowed.includes(value as T)) {
      this.errors.push(`${key} must be one of ${allowed.join(', ')} (got "${value}")`);
      return fallback;
    }
    return value as T;
  }

  list(key: string): string[] {
    const value = this.get(key);
    if (value === undefined) return [];
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const env = new EnvReader(raw);

  const config: AppConfig = {
    nodeEnv: env.enum('NODE_ENV', ['development', 'test', 'production'] as const, 'development'),
    port: env.num('PORT', { min: 1, max: 65535 }),
    corsOrigins: env.list('CORS_ORIGINS'),
    database: { url: env.str('DATABASE_URL') },
    jwt: {
      accessSecret: env.str('JWT_ACCESS_SECRET', { minLength: 32, notPlaceholder: true }),
      accessExpiresIn: env.str('JWT_ACCESS_EXPIRES_IN'),
      refreshSecret: env.str('JWT_REFRESH_SECRET', { minLength: 32, notPlaceholder: true }),
      refreshExpiresIn: env.str('JWT_REFRESH_EXPIRES_IN'),
    },
    bcryptRounds: env.num('BCRYPT_ROUNDS', { min: 10, max: 15 }),
    redis: {
      host: env.str('REDIS_HOST'),
      port: env.num('REDIS_PORT', { min: 1, max: 65535 }),
    },
    storage: {
      driver: env.enum('STORAGE_DRIVER', ['stub', 's3'] as const, 'stub'),
      bucket: env.str('S3_BUCKET'),
      region: env.str('S3_REGION'),
      endpoint: env.optionalStr('S3_ENDPOINT'),
    },
    vatRate: env.num('VAT_RATE', { min: 0, max: 1 }),
    defaultPlatformFeePct: env.num('DEFAULT_PLATFORM_FEE_PCT', { min: 0, max: 100 }),
    cartPriceLockHours: env.num('CART_PRICE_LOCK_HOURS', { min: 1 }),
  };

  if (env.errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${env.errors.join('\n  - ')}`,
    );
  }

  return config;
}
```

Errors accumulate rather than throwing on the first problem, so a developer with three missing variables learns all three from one boot attempt.

- [ ] **Step 4: Replace `src/config/configuration.ts`**

```ts
import { validateEnv, AppConfig } from './config.schema';

export default (): AppConfig => validateEnv(process.env);
export type { AppConfig };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/config`
Expected: all seven PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(config): add typed config with fail-fast env validation

Accumulates every validation error before throwing so a misconfigured
environment reports all problems in one boot rather than one per attempt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

