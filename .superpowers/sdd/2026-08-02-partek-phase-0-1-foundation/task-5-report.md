# Task 5 Report: Prisma schema — Catalog domain

## What was implemented

Appended all ten catalog models to `prisma/schema.prisma` (after the existing `ClientLocation` model, at the end of the file), verbatim from the task brief:

1. `Category` (self-referential tree via `"CategoryTree"` relation)
2. `VehicleMake`
3. `VehicleModel`
4. `Vehicle`
5. `Brand`
6. `Product`
7. `PartNumber`
8. `ProductImage`
9. `ProductVehicleCompatibility`
10. `ProductImportJob`

Followed the two-stage sequence specified in the task:
1. Pasted Step 1 exactly as written, including the five back-relation lines.
2. Removed the five lines that reference not-yet-defined models, replacing each with a comment, then ran the migration.

## Back-relation lines removed

- **`Product` model** — removed these four lines and replaced with a single comment `// Back-relations to CartItem/RfqLineItem/BidLineItem/PoLineItem are restored in Task 6.`:
  ```
  cartItems     CartItem[]
  rfqLineItems  RfqLineItem[]
  bidLineItems  BidLineItem[]
  poLineItems   PoLineItem[]
  ```
- **`Vehicle` model** — removed this line and replaced with a comment `// rfqLineItems RfqLineItem[] is restored in Task 6 Step 1, once RfqLineItem is defined.`:
  ```
  rfqLineItems  RfqLineItem[]
  ```

Everything else (field names, types, `@map`, `@@map`, `@@index`, `@@unique`, relation definitions) was transcribed exactly as in the brief — no renames, no reordering, no additions.

## Verification performed (actual output)

### `npx prisma migrate dev --name catalog`
```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "partek", schema "public" at "localhost:5434"

Applying migration `20260802150925_catalog`

The following migration(s) have been created and applied from new schema changes:

prisma/migrations/
  └─ 20260802150925_catalog/
    └─ migration.sql

Your database is now in sync with your schema.
```

### `npx prisma validate`
```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
The schema at prisma/schema.prisma is valid 🚀
```

### `npx tsc --noEmit`
No output (clean, exit 0) — consistent with the expected pre-existing state (Task 18 still owns `src/main.ts`, which was the only known gap and remains untouched).

### `docker exec partek-db psql -U partek -d partek -c "\dt"`
```
                    List of relations
 Schema |             Name              | Type  | Owner  
--------+-------------------------------+-------+--------
 public | _prisma_migrations            | table | partek
 public | brands                        | table | partek
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
 public | users                         | table | partek
 public | vehicle_makes                 | table | partek
 public | vehicle_models                | table | partek
 public | vehicles                      | table | partek
 public | vendor_documents              | table | partek
 public | vendor_locations              | table | partek
 public | vendors                       | table | partek
(21 rows)
```
10 new catalog tables confirmed: `categories`, `vehicle_makes`, `vehicle_models`, `vehicles`, `brands`, `products`, `part_numbers`, `product_images`, `product_vehicle_compatibility`, `product_import_jobs`.

Reviewed generated `migration.sql` (`prisma/migrations/20260802150925_catalog/migration.sql`) — all 10 `CREATE TABLE`, all indexes (including `vehicles_make_id_model_id_year_idx`), the `@@unique` on `product_vehicle_compatibility`, and all FKs match expectations. `exw_price_sar`/`d2d_price_sar`/`weight_kg`/`length_cm`/`width_cm`/`height_cm` all generated as `DECIMAL`, not float types, and are nullable as specified.

## Files changed

- `/home/daqqaq/repos/partek-be-phase1/prisma/schema.prisma` (modified — appended 160 lines)
- `/home/daqqaq/repos/partek-be-phase1/prisma/migrations/20260802150925_catalog/migration.sql` (new, generated)

Commit: `de4e3c0` — "feat(db): add catalog domain"

## Self-review findings

- All ten models present with every field, `@map`, `@@map`, `@@unique`, `@@index` matching the brief exactly (diffed against brief text field-by-field).
- Datasource `db` block untouched (no `url` line, as required).
- No new enums defined — `BrandType` and `ImportJobStatus` reused from existing schema.
- `Product.vendorId` and `ProductImportJob.vendorId`/`uploadedBy` left as plain `String @db.Uuid`, no relation — matches Task 4 pattern, per instructions.
- No CHECK constraint attempted for the exw/d2d "at least one" rule — left for Task 8 as instructed.
- Five deferred back-relation lines removed and clearly commented for Task 6 pickup.
- No stub models created for `CartItem`/`RfqLineItem`/`BidLineItem`/`PoLineItem`.
- No `src/main.ts`, `app.module.ts`, or any service/controller/module/test files created.
- Git commit only includes the two intended files (schema.prisma + new migration) — verified via `git show --stat` before writing this report. The stray untracked `package-lock.json` noted in the initial git status was not touched or staged.

## Issues or concerns

None. Migration applied cleanly on the first attempt; validation and typecheck both pass.
