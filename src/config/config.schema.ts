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
const PLACEHOLDER_PATTERN =
  /replace-me|change-me|do-not-ship|your-secret|example|changeme/i;

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
      this.errors.push(
        `${key} must be one of ${allowed.join(', ')} (got "${value}")`,
      );
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
    nodeEnv: env.enum(
      'NODE_ENV',
      ['development', 'test', 'production'] as const,
      'development',
    ),
    port: env.num('PORT', { min: 1, max: 65535 }),
    corsOrigins: env.list('CORS_ORIGINS'),
    database: { url: env.str('DATABASE_URL') },
    jwt: {
      accessSecret: env.str('JWT_ACCESS_SECRET', {
        minLength: 32,
        notPlaceholder: true,
      }),
      accessExpiresIn: env.str('JWT_ACCESS_EXPIRES_IN'),
      refreshSecret: env.str('JWT_REFRESH_SECRET', {
        minLength: 32,
        notPlaceholder: true,
      }),
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
    defaultPlatformFeePct: env.num('DEFAULT_PLATFORM_FEE_PCT', {
      min: 0,
      max: 100,
    }),
    cartPriceLockHours: env.num('CART_PRICE_LOCK_HOURS', { min: 1 }),
  };

  if (env.errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${env.errors.join('\n  - ')}`,
    );
  }

  return config;
}
