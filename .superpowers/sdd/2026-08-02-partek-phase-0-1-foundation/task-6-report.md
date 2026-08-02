# Task 6 Report: Prisma schema — Cart, RFQ, Bid, and snapshot domains

## What I implemented

1. **Step 1 — Restored back-relations from Task 5:**
   - `Vehicle.rfqLineItems RfqLineItem[]` — replaced the comment marker at the old line 378.
   - `Product.cartItems CartItem[]`, `Product.rfqLineItems RfqLineItem[]`, `Product.bidLineItems BidLineItem[]` — replaced the comment marker at the old line 422.
   - `Product.poLineItems` left commented out with a new marker (see below) since `PoLineItem` is a Task 7 model.

2. **Step 2 — Appended seven new models** to the end of `prisma/schema.prisma`, transcribed verbatim from the brief: `Cart`, `CartItem`, `Rfq`, `RfqLineItem`, `Bid`, `BidLineItem`, `BidAwardSnapshot`. `BidLineItem.poLineItems` left commented out (Task 7 dependency).

3. **Step 3 — Migration:** `npx prisma migrate dev --name cart_rfq_bid` — created and applied `prisma/migrations/20260802151501_cart_rfq_bid/migration.sql`.

4. **Step 4 — Verification:** `npx prisma validate` and `npx tsc --noEmit` both clean.

5. **Step 5 — Commit:** created with the exact message from the brief, including the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.

No enums were added — all five needed (`CartStatus`, `Incoterm`, `StockStatus`, `RfqStatus`, `BidStatus`) already existed from earlier tasks. No other files (services/controllers/modules/tests, `src/main.ts`) were touched.

## Back-relations restored vs. deferred

**Restored (4):**
- `Vehicle.rfqLineItems RfqLineItem[]`
- `Product.cartItems CartItem[]`
- `Product.rfqLineItems RfqLineItem[]`
- `Product.bidLineItems BidLineItem[]`

**Still deferred (2), both marked for Task 7:**
- `prisma/schema.prisma:425` — on `model Product`: `// poLineItems PoLineItem[] is restored in Task 7, once PoLineItem is defined.`
- `prisma/schema.prisma:596` — on `model BidLineItem`: `// poLineItems PoLineItem[] is restored in Task 7, once PoLineItem is defined.`

Confirmed via `grep -n "PoLineItem" prisma/schema.prisma` — exactly these two lines match, both commented.

## Verification performed (actual output)

### `npx prisma format`
```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Formatted prisma/schema.prisma in 42ms 🚀
```

### `npx prisma validate`
```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
The schema at prisma/schema.prisma is valid 🚀
```

### `npx prisma migrate dev --name cart_rfq_bid`
```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "partek", schema "public" at "localhost:5434"

Applying migration `20260802151501_cart_rfq_bid`

The following migration(s) have been created and applied from new schema changes:

prisma/migrations/
  └─ 20260802151501_cart_rfq_bid/
    └─ migration.sql

Your database is now in sync with your schema.
```

### `npx tsc --noEmit`
Exit code 0, no output (clean).

### New tables — `docker exec partek-db psql -U partek -d partek -c "\dt"`
```
                    List of relations
 Schema |             Name              | Type  | Owner  
--------+-------------------------------+-------+--------
 public | _prisma_migrations            | table | partek
 public | bid_award_snapshots           | table | partek
 public | bid_line_items                | table | partek
 public | bids                          | table | partek
 public | brands                        | table | partek
 public | cart_items                    | table | partek
 public | carts                         | table | partek
 public | categories                    | table | partek
 public | client_locations              | table | partek
 public | client_users                  | table | partek
 public | clients                       | table | partek
 public | document_types                | table | partek
 public | locations                     | table | partek
 public | part_numbers                  | table | partek
 public | product_images                | table | partek
 public | product_import_jobs           | table | partek
 public | product_vehicle_compatibility | table | partek
 public | products                      | table | partek
 public | refresh_tokens                | table | partek
 public | rfq_line_items                | table | partek
 public | rfqs                          | table | partek
 public | users                         | table | partek
 public | vehicle_makes                 | table | partek
 public | vehicle_models                | table | partek
 public | vehicles                      | table | partek
 public | vendor_documents              | table | partek
 public | vendor_locations              | table | partek
 public | vendors                       | table | partek
(28 rows)
```
Seven new tables confirmed: `carts`, `cart_items`, `rfqs`, `rfq_line_items`, `bids`, `bid_line_items`, `bid_award_snapshots`.

### `Bid` unique constraints — from generated migration SQL
```
128:CREATE UNIQUE INDEX "bids_rfq_id_vendor_id_key" ON "bids"("rfq_id", "vendor_id");
131:CREATE UNIQUE INDEX "bids_rfq_id_anonymous_label_key" ON "bids"("rfq_id", "anonymous_label");
```
Both required `@@unique` constraints from the brief are present in the generated SQL.

## Files changed

- `prisma/schema.prisma` — modified (Vehicle/Product restorations + seven appended models)
- `prisma/migrations/20260802151501_cart_rfq_bid/migration.sql` — new (generated)

## Self-review findings

- All seven models transcribed field-for-field, `@map`/`@@map` matching the brief exactly (verified by direct comparison against brief Step 2 block after `prisma format` re-aligned columns — no content changes, only whitespace).
- Both `Bid` `@@unique` constraints present and correctly enforced in the DB (confirmed in generated SQL).
- `CartItem.priceLockedUntil` has no default, as intended (populated by `CartsService` in Phase 3c).
- `BidLineItem` carries both `exwUnitPriceSar` and `d2dUnitPriceSar` as non-nullable `Decimal(10,2)`, `BidAwardSnapshot.totalAmountSar` is `Decimal(12,2)`, `lineItemsJson` is `Json` mapped to `line_items_json` — all match spec.
- Plain `String @db.Uuid` fields (`Cart.clientId`/`clientUserId`, `CartItem.vendorId`, `Rfq.clientId`/`createdBy`, `Bid.vendorId`, all four ID columns on `BidAwardSnapshot`) left as non-relational UUIDs per Task 8 deferral — not "fixed" into relations.
- Exactly two `PoLineItem` references remain, both commented out with Task 7 markers, confirmed via grep — no third deferred item and no stub `PoLineItem` model created.
- No enums added; no extra models, services, controllers, or `src/main.ts` created.
- `git status` clean after commit aside from the pre-existing untracked `package-lock.json` noted at session start (unrelated to this task, not touched).

## Issues or concerns

None. Migration applied cleanly, schema validated, TypeScript compiles clean, both Bid constraints verified in generated SQL and no destructive commands (`migrate reset`/`db push`) were run.
