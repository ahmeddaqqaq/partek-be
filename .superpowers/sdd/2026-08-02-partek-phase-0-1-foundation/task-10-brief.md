## Task 10: Prisma audit append-only client extension

**Files:**
- Create: `src/database/extensions/audit-append-only.extension.ts`
- Create: `src/database/extensions/audit-append-only.extension.spec.ts`
- Modify: `src/database/prisma.service.ts`

**Interfaces:**
- Consumes: `PrismaService` from Task 2, the `AuditLog` model from Task 7.
- Produces: `auditAppendOnly` (a Prisma client extension) and `PrismaService.audited` — the extended client that Task 16's `AuditRepository` uses. `AuditAppendOnlyError` is exported for the exception filter in Task 18.

The database trigger from Task 8 is the hard guarantee. This extension is the inner layer: it fails at the ORM boundary with a clear application error instead of surfacing a Postgres exception from three frames deeper.

- [ ] **Step 1: Write the failing test**

Create `src/database/extensions/audit-append-only.extension.spec.ts`:

```ts
import { PrismaService } from '../prisma.service';
import { AuditAppendOnlyError } from './audit-append-only.extension';

describe('auditAppendOnly extension', () => {
  let prisma: PrismaService;
  let actorId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `ext-${crypto.randomUUID()}@partek.test`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    actorId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const seedLog = () =>
    prisma.audited.auditLog.create({
      data: {
        actorId,
        entityType: 'User',
        entityId: actorId,
        action: 'created',
        ipAddress: '127.0.0.1',
      },
    });

  it('permits create', async () => {
    const log = await seedLog();
    expect(log.id).toBeDefined();
    expect(log.action).toBe('created');
  });

  it('permits findMany', async () => {
    await seedLog();
    const logs = await prisma.audited.auditLog.findMany({ where: { actorId } });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('throws on update', async () => {
    const log = await seedLog();
    await expect(
      prisma.audited.auditLog.update({
        where: { id: log.id },
        data: { action: 'tampered' },
      }),
    ).rejects.toThrow(AuditAppendOnlyError);
  });

  it('throws on delete', async () => {
    const log = await seedLog();
    await expect(
      prisma.audited.auditLog.delete({ where: { id: log.id } }),
    ).rejects.toThrow(AuditAppendOnlyError);
  });

  it('throws on updateMany, deleteMany, and upsert', async () => {
    await expect(
      prisma.audited.auditLog.updateMany({
        where: { actorId },
        data: { action: 'tampered' },
      }),
    ).rejects.toThrow(AuditAppendOnlyError);

    await expect(
      prisma.audited.auditLog.deleteMany({ where: { actorId } }),
    ).rejects.toThrow(AuditAppendOnlyError);

    await expect(
      prisma.audited.auditLog.upsert({
        where: { id: crypto.randomUUID() },
        create: {
          actorId,
          entityType: 'User',
          entityId: actorId,
          action: 'created',
          ipAddress: '127.0.0.1',
        },
        update: { action: 'tampered' },
      }),
    ).rejects.toThrow(AuditAppendOnlyError);
  });

  it('leaves other models mutable', async () => {
    const category = await prisma.audited.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });
    const updated = await prisma.audited.category.update({
      where: { id: category.id },
      data: { nameEn: 'Renamed' },
    });
    expect(updated.nameEn).toBe('Renamed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/database/extensions`
Expected: FAIL — `Cannot find module './audit-append-only.extension'`.

- [ ] **Step 3: Write the extension**

Create `src/database/extensions/audit-append-only.extension.ts`:

```ts
import { Prisma } from '@prisma-client';

export class AuditAppendOnlyError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(
      `audit_logs is append-only: "${operation}" is not permitted. ` +
        'Audit entries are immutable by design.',
    );
    this.name = 'AuditAppendOnlyError';
    this.operation = operation;
  }
}

const FORBIDDEN = [
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
] as const;

export const auditAppendOnly = Prisma.defineExtension({
  name: 'auditAppendOnly',
  query: {
    auditLog: {
      $allOperations({ operation, args, query }) {
        if ((FORBIDDEN as readonly string[]).includes(operation)) {
          return Promise.reject(new AuditAppendOnlyError(operation));
        }
        return query(args);
      },
    },
  },
});
```

`$allOperations` scoped to the `auditLog` model is the right hook: it intercepts every operation on that one model without touching any other, so `prisma.audited.category.update()` still works.

- [ ] **Step 4: Expose the extended client on `PrismaService`**

Modify `src/database/prisma.service.ts` — add the import, the field, and the initialisation:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma-client';
import { auditAppendOnly } from './extensions/audit-append-only.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * The audit-guarded client. Repositories that touch audit_logs MUST use
   * this rather than `this` directly — the base client bypasses the
   * append-only extension (the database trigger still catches it, but the
   * error is far less legible).
   */
  readonly audited: ReturnType<PrismaService['buildAudited']>;

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL as string,
      }),
    });
    this.audited = this.buildAudited();
  }

  private buildAudited() {
    return this.$extends(auditAppendOnly);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`$extends` returns a *new* client rather than mutating the receiver, which is why the extended client is exposed as a field instead of the class simply being extended. The `ReturnType<PrismaService['buildAudited']>` self-reference keeps the extended client fully typed without hand-writing it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/database`
Expected: all tests in `constraints.spec.ts` and `audit-append-only.extension.spec.ts` PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add audit append-only Prisma client extension

Inner layer of the two-layer guarantee. The Task 8 trigger is the hard
stop; this fails at the ORM boundary with a legible application error.
Exposed as PrismaService.audited because \$extends returns a new client
rather than mutating the receiver.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

