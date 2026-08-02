## Task 8: Raw SQL constraints Prisma cannot express

**Files:**
- Create: `prisma/migrations/<timestamp>_raw_constraints/migration.sql` (hand-written)
- Create: `src/database/constraints.spec.ts`

**Interfaces:**
- Consumes: the complete schema from Task 7.
- Produces: named database constraints that later tasks assert against — `product_images_one_hero_per_product`, `products_at_least_one_price`, `purchase_orders_source_type_integrity`, and `audit_logs_append_only`. The exception filter in Task 18 maps these names to HTTP 422.

Four of the spec's business rules cannot live in `schema.prisma`. They are created here as a hand-written migration.

- [ ] **Step 1: Create an empty migration**

```bash
npx prisma migrate dev --create-only --name raw_constraints
```

This scaffolds an empty `migration.sql` without applying it.

- [ ] **Step 2: Write the migration SQL**

Replace the generated (empty) `migration.sql` with:

```sql
-- Rule: only one product_images row per product may have is_hero = true.
CREATE UNIQUE INDEX product_images_one_hero_per_product
  ON product_images (product_id)
  WHERE is_hero;

-- Rule: a product must carry at least one of the two prices.
ALTER TABLE products
  ADD CONSTRAINT products_at_least_one_price
  CHECK (exw_price_sar IS NOT NULL OR d2d_price_sar IS NOT NULL);

-- Rule: direct POs come from a cart; RFQ POs come from an RFQ and a bid.
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_source_type_integrity
  CHECK (
    (source_type = 'direct' AND cart_id IS NOT NULL)
    OR
    (source_type = 'rfq' AND rfq_id IS NOT NULL AND bid_id IS NOT NULL)
  );

-- Rule: audit_logs is append-only. This trigger is the outer layer; the
-- Prisma client extension in Task 10 is the inner one. The trigger also
-- catches raw SQL, psql sessions, and any future non-Prisma consumer.
CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'check_violation',
          CONSTRAINT = 'audit_logs_append_only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- Deferred foreign keys for the user-reference columns that were left as
-- plain uuid in the Prisma schema (see Task 4 note).
ALTER TABLE vendors
  ADD CONSTRAINT vendors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE vendors
  ADD CONSTRAINT vendors_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE clients
  ADD CONSTRAINT clients_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE client_users
  ADD CONSTRAINT client_users_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE vendor_documents
  ADD CONSTRAINT vendor_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE vendor_documents
  ADD CONSTRAINT vendor_documents_validated_by_fkey
  FOREIGN KEY (validated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE delivery_agents
  ADD CONSTRAINT delivery_agents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

-- Postgres does NOT create an index for a foreign key column. Both of these
-- are on the authorization path -- "which vendor does this user own" and
-- "which clients is this user a member of" run on essentially every request
-- from a vendor or client account. client_users already has a unique index
-- on (client_id, user_id), but user_id is not its leftmost column, so a
-- lookup by user_id alone cannot use it.
CREATE INDEX vendors_user_id_idx ON vendors (user_id);
CREATE INDEX client_users_user_id_idx ON client_users (user_id);

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
```

- [ ] **Step 3: Apply the migration**

```bash
npx prisma migrate dev
```

Expected: `raw_constraints` applies cleanly.

- [ ] **Step 4: Write the failing integration test**

These constraints exist only in the database, so they cannot be tested with a mock. Create `src/database/constraints.spec.ts`:

```ts
import { PrismaService } from './prisma.service';

describe('database constraints', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a product with neither price', async () => {
    const category = await prisma.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });

    await expect(
      prisma.product.create({
        data: {
          vendorId: crypto.randomUUID(),
          categoryId: category.id,
          nameAr: 'قطعة',
          nameEn: 'Part',
          stockQuantity: 1,
        },
      }),
    ).rejects.toThrow(/products_at_least_one_price/);
  });

  it('rejects a second hero image on the same product', async () => {
    const category = await prisma.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });
    const product = await prisma.product.create({
      data: {
        vendorId: crypto.randomUUID(),
        categoryId: category.id,
        nameAr: 'قطعة',
        nameEn: 'Part',
        exwPriceSar: '100.00',
        stockQuantity: 1,
      },
    });

    await prisma.productImage.create({
      data: { productId: product.id, imageUrl: 'a.jpg', isHero: true },
    });

    await expect(
      prisma.productImage.create({
        data: { productId: product.id, imageUrl: 'b.jpg', isHero: true },
      }),
    ).rejects.toThrow();
  });

  it('permits many non-hero images on the same product', async () => {
    const category = await prisma.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });
    const product = await prisma.product.create({
      data: {
        vendorId: crypto.randomUUID(),
        categoryId: category.id,
        nameAr: 'قطعة',
        nameEn: 'Part',
        d2dPriceSar: '120.00',
        stockQuantity: 1,
      },
    });

    await prisma.productImage.create({
      data: { productId: product.id, imageUrl: 'a.jpg', isHero: false },
    });
    await prisma.productImage.create({
      data: { productId: product.id, imageUrl: 'b.jpg', isHero: false },
    });

    const count = await prisma.productImage.count({
      where: { productId: product.id },
    });
    expect(count).toBe(2);
  });

  it('rejects UPDATE on audit_logs', async () => {
    const user = await prisma.user.create({
      data: {
        email: `audit-${crypto.randomUUID()}@partek.test`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    const log = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'created',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET action = 'tampered' WHERE id = ${log.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE on audit_logs', async () => {
    const user = await prisma.user.create({
      data: {
        email: `audit-${crypto.randomUUID()}@partek.test`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    const log = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'created',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(
      prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${log.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/database/constraints.spec.ts`
Expected: all five PASS. A failure on the hero-image test means the partial index did not apply; a failure on either audit test means the trigger did not.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add raw SQL constraints and audit append-only trigger

Four spec business rules cannot be expressed in schema.prisma: the
single-hero partial unique index, the at-least-one-price check, the PO
source_type integrity check, and the audit_logs append-only trigger.
Adds the user-reference foreign keys deliberately omitted from the
Prisma models. Covered by integration tests against real Postgres --
mocks cannot verify database constraints.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

