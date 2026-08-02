## Task 19: BullMQ queues and the storage stub

**Files:**
- Create: `src/queues/queues.module.ts`
- Create: `src/queues/queue-names.ts`
- Create: `src/queues/processors/{product-import,notification-dispatch,cart-staleness-sweep,zatca-submission}.processor.ts`
- Create: `src/common/storage/storage.service.ts`
- Create: `src/common/storage/storage.service.spec.ts`
- Create: `src/common/storage/storage.module.ts`
- Modify: `src/app.module.ts` (uncomment the two imports)

**Interfaces:**
- Consumes: `AppConfig` from Task 9.
- Produces:
  - `QUEUE_NAMES` — the four queue name constants Phase 3 injects by.
  - `IStorageService.upload(file: UploadInput): Promise<StoredFile>`, `.getSignedUrl(key)`, `.delete(key)`; `STORAGE_SERVICE` injection token.
  - `StoredFile { key: string; url: string; size: number; contentType: string }`

- [ ] **Step 1: Write `src/queues/queue-names.ts`**

```ts
export const QUEUE_NAMES = {
  PRODUCT_IMPORT: 'product-import',
  NOTIFICATION_DISPATCH: 'notification-dispatch',
  CART_STALENESS_SWEEP: 'cart-staleness-sweep',
  ZATCA_SUBMISSION: 'zatca-submission',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
```

- [ ] **Step 2: Write the four stub processors**

`src/queues/processors/product-import.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue-names';

export interface ProductImportJobData {
  importJobId: string;
  vendorId: string;
  fileUrl: string;
}

/**
 * STUB. Implemented in Phase 3b. The real processor groups rows by primary
 * part_number, parses alt_part_numbers as SOURCE:NUMBER;SOURCE:NUMBER,
 * resolves vehicles by make + model + year case-insensitively (rejecting
 * the row rather than auto-creating), then writes product, part_numbers,
 * and compatibility records.
 */
@Processor(QUEUE_NAMES.PRODUCT_IMPORT)
export class ProductImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductImportProcessor.name);

  async process(job: Job<ProductImportJobData>): Promise<void> {
    this.logger.warn(
      `STUB: product import job ${job.id} for vendor ${job.data.vendorId} ` +
        'was received but not processed. Implemented in Phase 3b.',
    );
  }
}
```

`src/queues/processors/notification-dispatch.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue-names';

export interface NotificationDispatchJobData {
  notificationId: string;
  userId: string;
  channel: 'email' | 'sms' | 'push';
}

/** STUB. Implemented alongside the notification channels in Phase 3d. */
@Processor(QUEUE_NAMES.NOTIFICATION_DISPATCH)
export class NotificationDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDispatchProcessor.name);

  async process(job: Job<NotificationDispatchJobData>): Promise<void> {
    this.logger.warn(
      `STUB: notification ${job.data.notificationId} not dispatched via ` +
        `${job.data.channel}. Implemented in Phase 3d.`,
    );
  }
}
```

`src/queues/processors/cart-staleness-sweep.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../queue-names';

/**
 * STUB. Implemented in Phase 3c. Flips cart_items.is_stale where
 * price_locked_until has passed. Staleness is also computed on read, so
 * responses are correct even when this has not run -- this exists to make
 * staleness queryable.
 */
@Processor(QUEUE_NAMES.CART_STALENESS_SWEEP)
export class CartStalenessSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(CartStalenessSweepProcessor.name);

  async process(): Promise<void> {
    this.logger.warn('STUB: cart staleness sweep. Implemented in Phase 3c.');
  }
}
```

`src/queues/processors/zatca-submission.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue-names';

export interface ZatcaSubmissionJobData {
  zatcaInvoiceId: string;
  attempt: number;
}

/** STUB. Implemented in Phase 3d, including the retry ladder. */
@Processor(QUEUE_NAMES.ZATCA_SUBMISSION)
export class ZatcaSubmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(ZatcaSubmissionProcessor.name);

  async process(job: Job<ZatcaSubmissionJobData>): Promise<void> {
    this.logger.warn(
      `STUB: ZATCA invoice ${job.data.zatcaInvoiceId} not submitted. ` +
        'Implemented in Phase 3d.',
    );
  }
}
```

Every stub logs at `warn`, not `debug`. A silent stub that looks like a success is how unimplemented work reaches production unnoticed.

- [ ] **Step 3: Write `src/queues/queues.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '@/config/configuration';
import { QUEUE_NAMES } from './queue-names';
import { ProductImportProcessor } from './processors/product-import.processor';
import { NotificationDispatchProcessor } from './processors/notification-dispatch.processor';
import { CartStalenessSweepProcessor } from './processors/cart-staleness-sweep.processor';
import { ZatcaSubmissionProcessor } from './processors/zatca-submission.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: {
          host: config.get('redis.host', { infer: true }),
          port: config.get('redis.port', { infer: true }),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 604_800 },
        },
      }),
    }),
    ...Object.values(QUEUE_NAMES).map((name) => BullModule.registerQueue({ name })),
  ],
  providers: [
    ProductImportProcessor,
    NotificationDispatchProcessor,
    CartStalenessSweepProcessor,
    ZatcaSubmissionProcessor,
  ],
  exports: [BullModule],
})
export class QueuesModule {}
```

Failed jobs are retained for seven days while completed ones are dropped after a day — a failed import is evidence, a successful one is not.

- [ ] **Step 4: Write the failing storage test**

Create `src/common/storage/storage.service.spec.ts`:

```ts
import { StubStorageService } from './storage.service';

describe('StubStorageService', () => {
  const service = new StubStorageService({
    driver: 'stub', bucket: 'partek-dev', region: 'me-south-1',
  } as any);

  const file = {
    buffer: Buffer.from('col_a,col_b\n1,2\n'),
    originalname: 'catalog.csv',
    mimetype: 'text/csv',
    size: 16,
  };

  it('returns a key namespaced by prefix and preserving the extension', async () => {
    const stored = await service.upload(file, 'imports');
    expect(stored.key).toMatch(/^imports\/[0-9a-f-]{36}\.csv$/);
  });

  it('returns a URL that is obviously not a real bucket URL', async () => {
    const stored = await service.upload(file, 'imports');
    expect(stored.url).toContain('stub-storage.invalid');
  });

  it('preserves size and content type', async () => {
    const stored = await service.upload(file, 'imports');
    expect(stored.size).toBe(16);
    expect(stored.contentType).toBe('text/csv');
  });

  it('generates unique keys for identical files', async () => {
    const [a, b] = await Promise.all([
      service.upload(file, 'imports'),
      service.upload(file, 'imports'),
    ]);
    expect(a.key).not.toBe(b.key);
  });

  it('returns a signed URL bearing a stub marker', async () => {
    await expect(service.getSignedUrl('imports/x.csv')).resolves.toContain('stub');
  });

  it('resolves delete without throwing', async () => {
    await expect(service.delete('imports/x.csv')).resolves.toBeUndefined();
  });
});
```

The `.invalid` TLD is reserved by RFC 2606 and can never resolve, so a stub URL that escapes into the frontend fails visibly instead of silently 404ing against a real-looking host.

- [ ] **Step 5: Run to verify failure**

Run: `npx jest src/common/storage`
Expected: FAIL — `Cannot find module './storage.service'`.

- [ ] **Step 6: Write `src/common/storage/storage.service.ts`**

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AppConfig } from '@/config/configuration';

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface UploadInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface IStorageService {
  upload(file: UploadInput, prefix: string): Promise<StoredFile>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

/**
 * Stub implementation. Stores nothing and returns URLs on the reserved
 * .invalid TLD (RFC 2606), which can never resolve -- so a stub URL that
 * leaks into the frontend fails visibly rather than looking plausible.
 * Replaced by an S3 implementation behind the same interface.
 */
@Injectable()
export class StubStorageService implements IStorageService {
  private readonly logger = new Logger(StubStorageService.name);

  constructor(@Inject('STORAGE_CONFIG') private readonly config: AppConfig['storage']) {}

  async upload(file: UploadInput, prefix: string): Promise<StoredFile> {
    const key = `${prefix}/${randomUUID()}${extname(file.originalname)}`;
    this.logger.warn(
      `STUB: "${file.originalname}" (${file.size} bytes) was NOT persisted. ` +
        `Pretending it landed at ${key}.`,
    );
    return {
      key,
      url: `https://${this.config.bucket}.stub-storage.invalid/${key}`,
      size: file.size,
      contentType: file.mimetype,
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return `https://${this.config.bucket}.stub-storage.invalid/${key}?stub-signature=not-a-real-signature&expires=${expiresInSeconds}`;
  }

  async delete(key: string): Promise<void> {
    this.logger.warn(`STUB: delete of ${key} was a no-op.`);
  }
}
```

- [ ] **Step 7: Write `src/common/storage/storage.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '@/config/configuration';
import { STORAGE_SERVICE, StubStorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: 'STORAGE_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        config.get('storage', { infer: true }),
    },
    { provide: STORAGE_SERVICE, useClass: StubStorageService },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
```

Consumers inject `STORAGE_SERVICE` and depend on `IStorageService`, never on `StubStorageService` — swapping in S3 becomes a one-line change here.

- [ ] **Step 8: Uncomment `QueuesModule` and `StorageModule` in `app.module.ts`, then verify**

```bash
npx jest src/common/storage
npm run start:dev
```

Expected: 6 storage tests PASS; the app boots and connects to Redis with no errors. If Redis is unreachable the app will not start — confirm `docker compose ps` shows `partek-redis` healthy.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: register BullMQ queues and add the storage stub

Four queues with stub processors that log at warn, not debug -- a silent
stub is how unimplemented work reaches production unnoticed. Stub storage
URLs use the reserved .invalid TLD so they can never resolve.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

