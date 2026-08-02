# Partek Platform — Design Spec

**Date:** 2026-08-02
**Supersedes:** `2026-06-06-partek-api-design.md` (scaffold-only spec; single `User` model)

---

## Overview

Partek is a B2B automotive parts marketplace for the Saudi/GCC market. It connects verified
auto-parts vendors with business buyers (fleet operators, workshops, dealerships) through two
purchasing paths:

- **Competitive RFQ bidding** — client publishes an RFQ, vendors submit anonymous bids, client
  awards one, award converts to a purchase order.
- **Direct catalog buying** — client adds catalog products to a cart with a 48-hour price lock,
  checks out, PO goes through internal approval.

Both paths converge on the same order → payment → delivery → disbursement → ZATCA invoice pipeline.

Two deliverables:

1. **`partek-be`** — NestJS REST API (renamed from the existing `partek` directory).
2. **`partek-fe`** — Next.js App Router wireframe on mock data, four portals.

---

## Locked Decisions

These were resolved before design and are not open for re-litigation during implementation.

| Decision | Choice | Rationale |
|---|---|---|
| ORM | **Prisma** | The original product prompt specified TypeORM, but the existing `partek` scaffold is Prisma-based and already committed. Prisma wins; the repository-per-module requirement is satisfied by hand-written repository classes (see *Data Layer*). |
| Build order | **BE foundation → FE wireframe → BE domains** | Locks the data model early, then produces something clickable quickly, then fills in the remaining 20 modules. |
| Accent color | **Deep blue / indigo** | Reads trustworthy and B2B-financial; pairs cleanly with the pastel semantic state palette. |
| Repo layout | **`partek-be` + `partek-fe` as siblings** | Matches the existing `banla-api` / `banla-admin` naming. Not a monorepo. |
| Primary keys | **UUID** everywhere | Replaces the `cuid()` on the existing `User` model. |
| Next.js version | **Latest stable** (App Router) | The product prompt says Next 14; as of 2026-08 that is two majors behind. The App Router API used here is unchanged, so there is no reason to pin backwards. Revisit only if an external constraint requires 14. |

---

## Architecture

### Backend module layout

```
partek-be/src/
  auth/  users/  vendors/  clients/  locations/  categories/  vehicles/
  brands/  products/  product-import/  carts/  rfqs/  bids/
  purchase-orders/  orders/  payments/  disbursements/  delivery/
  zatca/  returns/  notifications/  audit/
  common/
    decorators/   # @CurrentUser, @Roles, @Public
    guards/       # JwtAuthGuard (global), RolesGuard
    filters/      # global exception filter
    interceptors/ # serialization, audit, logging
    pipes/        # global ValidationPipe config
  config/         # typed @nestjs/config factory
  database/       # PrismaService, PrismaModule, Prisma client extensions
```

### Data layer

The product prompt asks for a **Repository** per module. Prisma exposes a single central client
rather than per-entity repositories, so the boundary is created by hand:

```
src/<domain>/
  <domain>.repository.ts   # the ONLY file permitted to touch PrismaService
  <domain>.service.ts      # business rules; receives the repository via DI
  <domain>.controller.ts   # Swagger-decorated
  dto/{create,update,response}-<domain>.dto.ts
```

Services never import `PrismaService`. This gives the repository boundary the prompt asked for and
makes services unit-testable against a mocked repository — which matters most for the bid-anonymity
rule, where a leak is a business-critical failure rather than a bug.

**Naming:** `snake_case` columns in Postgres via `@map` / `@@map`; `camelCase` in TypeScript.

### Data flow

```
Request → Controller → Service → Repository → PrismaService → PostgreSQL
              ↑            ↓
    ValidationPipe    AuditService (on significant state changes)
                      NotificationsService
```

### Cross-cutting infrastructure

- **Auth:** JWT access token (15m) + refresh token (7d), Passport strategy, bcrypt password hashing.
- **Guards:** `JwtAuthGuard` registered globally via `APP_GUARD`; routes opt out with `@Public()`.
  `RolesGuard` reads `@Roles()` metadata and checks against `user.role`.
- **Queue:** BullMQ with Redis. Queues are defined and registered in Phase 1; processors are stubbed
  and filled in as their owning module lands.
- **Storage:** S3-compatible service behind an `IStorageService` interface. Phase 1 ships a stub
  implementation that returns deterministic fake URLs and writes nothing. No real credentials.
- **PSP and ZATCA:** stubbed the same way — interface plus fake implementation, no external calls.

---

## Domain Model

All tables use UUID primary keys, `created_at` / `updated_at` timestamps where listed, and
`snake_case` column names. Enums are Prisma enums mapped to Postgres enums.

### Users & Auth

- **users** — email (unique), password_hash, phone, role `admin|vendor|client|delivery_agent`,
  status `active|inactive|suspended`, preferred_language `ar|en`, last_login_at, timestamps
- **refresh_tokens** *(added — see Schema Additions)* — user_id, token_hash, expires_at, revoked_at,
  user_agent, ip_address, created_at

### Vendor Domain

- **vendors** — user_id, company_name_ar/en, cr_number (unique), vat_number,
  status `pending|approved|rejected|info_required|suspended`, approved_by, approved_at,
  rejection_reason, platform_fee_pct *(added, nullable override)*, timestamps
- **document_types** — name_ar/en, is_required, is_active
- **vendor_documents** — vendor_id, document_type_id, file_url, expiry_date, is_valid, uploaded_by,
  validated_by, uploaded_at

### Locations

- **locations** — name, address_line, lat (decimal 10,7), lng (decimal 10,7)
- **vendor_locations** — vendor_id, location_id
- **client_locations** — client_id, location_id

### Client Domain

- **clients** — company_name_ar/en, cr_number (unique), vat_number,
  status `pending|approved|rejected|suspended`, approved_by, approved_at, rejection_reason, timestamps
- **client_users** — client_id, user_id, org_role `submitter|approver|escalation_manager`,
  is_active, created_at

### Catalog Domain

- **categories** — name_ar/en, parent_id (self-referencing, nullable), is_active, created_at
- **vehicle_makes** — name_ar/en, logo_url
- **vehicle_models** — make_id, name_ar/en
- **vehicles** — make_id, model_id, trim, year (smallint), vin
- **brands** — name_ar/en, brand_type `oem|aftermarket`
- **products** — vendor_id, category_id, brand_id, oem_part_number, name_ar/en, description_ar/en,
  exw_price_sar (10,2), d2d_price_sar (10,2), stock_quantity, weight_kg, length_cm, width_cm,
  height_cm, is_active, quality_validated, timestamps
- **part_numbers** — product_id, part_number, source
- **product_images** — product_id, image_url, is_hero, sort_order (smallint), created_at
- **product_vehicle_compatibility** — product_id, vehicle_id
- **product_import_jobs** — vendor_id, uploaded_by, file_url,
  status `pending|processing|completed|failed|partial`, total_rows, succeeded_rows, failed_rows,
  error_report_url, started_at, completed_at, created_at

### Cart & Direct Buy

- **carts** — client_id, client_user_id, status `active|converted|abandoned`, timestamps
- **cart_items** — cart_id, product_id, vendor_id, quantity, selected_incoterm `exw|d2d`,
  unit_price_snapshot_sar (10,2), added_at, price_locked_until, is_stale (default false),
  stock_status `in_stock|out_of_stock`

### RFQ & Bidding

- **rfqs** — client_id, created_by (client_users), rfq_number (unique), preferred_delivery_date,
  bid_deadline, status `draft|open|closed|awarded|cancelled|expired`, timestamps
- **rfq_line_items** — rfq_id, vehicle_id, product_id, part_description, quantity, specifications
- **bids** — rfq_id, vendor_id, anonymous_label, incoterm `exw|d2d`, estimated_delivery_days, notes,
  status `submitted|awarded|rejected|withdrawn`, submitted_at, updated_at.
  *(added: unique on `(rfq_id, vendor_id)`)*
- **bid_line_items** — bid_id, rfq_line_item_id, product_id, exw_unit_price_sar (10,2),
  d2d_unit_price_sar (10,2), quantity_available

### Price Snapshots

- **bid_award_snapshot** — bid_id, rfq_id, client_id, vendor_id, selected_incoterm,
  total_amount_sar (12,2), line_items_json (jsonb), awarded_at, awarded_by (client_users)
- **po_confirmation_snapshot** — po_id, bid_award_snapshot_id, selected_incoterm,
  total_amount_sar (12,2), vat_amount_sar (10,2), line_items_json (jsonb), confirmed_at,
  confirmed_by (users)

### Order Domain

- **purchase_orders** — po_number (unique), source_type `rfq|direct`, cart_id, rfq_id, bid_id,
  client_id, vendor_id, created_by (client_users), selected_incoterm, total_amount_sar (12,2),
  status `pending|approved|rejected|confirmed|cancelled`, approved_by, approved_at, timestamps
- **po_line_items** — po_id, bid_line_item_id, product_id, description, quantity,
  unit_price_sar (10,2), line_total_sar (12,2)
- **orders** — order_number (unique), po_id, vendor_id, client_id, created_by (users), source_type,
  selected_incoterm,
  status `pending|confirmed|preparing|ready_pickup|in_transit|delivered|completed|returned|cancelled`,
  total_amount_sar (12,2), platform_fee_sar (10,2), net_vendor_amount_sar (12,2), timestamps
- **order_status_history** — order_id, previous_status, new_status, changed_by, reason, changed_at

### Payment Domain

- **payments** — order_id, payment_type `collection|refund`, amount_sar (12,2), psp_reference,
  psp_provider, status `initiated|succeeded|failed`, failure_code, timestamps
- **vendor_disbursements** — order_id, vendor_id, gross_amount_sar, platform_fee_sar,
  platform_fee_pct, net_amount_sar, psp_reference, status `pending|initiated|completed|failed`,
  settlement_due_date, completed_at, created_at
- **platform_fee_invoices** — disbursement_id, vendor_id, fee_amount_sar, vat_on_fee_sar,
  zatca_invoice_id, created_at

### Delivery Domain

- **delivery_agents** — user_id, carrier_name, agent_code, is_active, created_at
- **delivery_tasks** — order_id, agent_id (nullable), delivery_hash *(nullable — see Schema
  Additions)*, carrier_reference, pickup_address, delivery_address, item_manifest (jsonb),
  status `assigned|pickup_confirmed|in_transit|delivered|failed`, assigned_by, estimated_delivery,
  timestamps
- **proof_of_delivery** — delivery_task_id, agent_id, photo_url, signature_url, recipient_name,
  geolocation_lat, geolocation_lng, captured_at

### Compliance

- **zatca_invoices** — order_id, invoice_number (unique), invoice_type `standard|credit_note`,
  total_amount_sar, vat_amount_sar, xml_document_url, cryptographic_hash, zatca_reference,
  submission_status `pending|submitted|accepted|rejected|retry`, failure_code, submitted_at,
  created_at

### Returns

- **return_requests** — order_id, client_id, reason_code, reason_description, photo_evidence_url,
  status `requested|under_review|approved|rejected|pickup_scheduled|received|refunded`, mediated_by,
  resolution_notes, refund_amount_sar, timestamps

### Audit & System

- **audit_logs** — actor_id, entity_type, entity_id (uuid), action, previous_state (jsonb),
  new_state (jsonb), metadata (jsonb), ip_address, created_at. **Append-only.**
- **notifications** — user_id, notification_type, title_ar/en, message_ar/en, entity_type,
  entity_id, is_read, created_at

---

## Schema Additions and Corrections

The source table list had gaps that block stated requirements. These are additions to the spec, not
open questions.

1. **`refresh_tokens` table added.** The requirements call for refresh tokens *and* logout. Logout
   means invalidation, which requires server-side storage. Without this table, logout is a no-op.
   Refresh tokens are stored hashed; logout revokes by setting `revoked_at`.

2. **`delivery_tasks.delivery_hash` is nullable.** The hash is `SHA-256(order_id + agent_id +
   timestamp)`, but `agent_id` is nullable at task creation. The hash is generated at the moment an
   agent is assigned, not at task creation.

3. **`bids` gets `@@unique([rfq_id, vendor_id])`.** One bid per vendor per RFQ. A vendor revises by
   updating their existing bid while the RFQ is open, not by inserting a second one.

4. **`anonymous_label` is allocated by the service, not the caller.** Assigned at first bid per RFQ
   from a per-RFQ counter inside a transaction, producing "Supplier A", "Supplier B", etc. Labels are
   stable within an RFQ and carry no cross-RFQ correlation.

5. **`vendors.platform_fee_pct` added (nullable).** `vendor_disbursements.platform_fee_pct` had no
   source. Resolution order: vendor override → config default. A `platform_settings` table is the
   eventual answer but is not built now.

6. **`cart_items.is_stale` is both computed and stored.** Staleness is derivable from
   `price_locked_until < now()`, and it is computed on read so responses are always correct. The
   column is retained and maintained by a scheduled BullMQ sweeper so staleness is also queryable.

7. **RFQ visibility is unscoped.** All approved vendors can see all `open` RFQs. There is no
   invite-only mechanism. If targeted RFQs become a requirement, that is an `rfq_invited_vendors`
   table and a visibility filter in `RfqsService`.

8. **VAT is a single config constant at 15%.** Read from one place by ZATCA invoices, PO
   confirmation snapshots, and platform fee invoices. Never hard-coded at a call site.

---

## Business Rule Enforcement

Rules that cannot be expressed in `schema.prisma` and require raw SQL in migrations, or that require
a specific service-layer chokepoint.

| Rule | Enforcement |
|---|---|
| Vendor identity must never reach a client role | `BidClientResponseDto` has no `vendorId` field at all — the leak is structurally impossible, not filtered out. A role-aware mapper selects the client DTO for `client` role and the full DTO for `admin`/`vendor`. Backed by an e2e test asserting no bid-related response body contains any vendor UUID under a client token. |
| One `is_hero` image per product | Partial unique index: `CREATE UNIQUE INDEX ... ON product_images(product_id) WHERE is_hero`, plus a service transaction that demotes the previous hero before promoting the new one. |
| At least one of `exw_price_sar` / `d2d_price_sar` | `CHECK (exw_price_sar IS NOT NULL OR d2d_price_sar IS NOT NULL)` plus a custom class-validator decorator on the product DTOs. |
| `cart_items.price_locked_until = added_at + 48h` | Set in `CartsService`. The create DTO has no such field, so a caller cannot supply or override it. |
| PO source_type integrity | `CHECK ((source_type='direct' AND cart_id IS NOT NULL) OR (source_type='rfq' AND rfq_id IS NOT NULL AND bid_id IS NOT NULL))`. |
| `audit_logs` append-only | Two layers. (a) A Prisma client extension that throws on `update`/`updateMany`/`delete`/`deleteMany`/`upsert` for the `AuditLog` model — Prisma cannot otherwise prevent `prisma.auditLog.update()`. (b) A Postgres trigger raising an exception on UPDATE/DELETE, catching anything that bypasses the ORM. `AuditService` exposes `log()` and read methods only; no update or delete endpoints exist. |
| `order_status_history` written on every transition | A single chokepoint, `OrdersService.transitionStatus()`, writes both the new status and the history row in one transaction. The orders repository exposes no generic status setter, so no other code path can write `orders.status`. |
| Import vehicle resolution | Match by make name + model name + year, case-insensitive. A row whose vehicle does not resolve is **rejected and logged** — vehicles are never auto-created. |

### Product import processing

BullMQ job, processor stubbed in Phase 1 and implemented in Phase 3b:

1. Group rows by primary `part_number`.
2. Parse `alt_part_numbers` cell, format `SOURCE:NUMBER;SOURCE:NUMBER`.
3. Resolve vehicles by make/model/trim/year, case-insensitive; reject the row on no match.
4. Create `products` + `part_numbers` + `product_vehicle_compatibility` records.
5. Write a CSV error report through the storage stub; record counts on `product_import_jobs`.

---

## Frontend — `partek-fe`

A wireframe on static mock data. No API calls, no fetching, no auth flow.

### Stack

Next.js (latest stable, App Router), TypeScript, Tailwind CSS, shadcn/ui, lucide-react,
Framer Motion.

### Structure

```
src/
  app/
    page.tsx                    # portal selector
    (portals)/admin/…           # 7 pages
    (portals)/vendor/…          # 8 pages
    (portals)/client/…          # 10 pages
    (portals)/delivery/…        # 4 pages
  components/                   # shared component library
  mock/                         # typed static data
  lib/
```

### Portals

- **Admin** — dashboard, vendor management (approve/reject/request-info + document drawer), client
  management, catalog management (quality toggle + category tree), orders, returns, disbursements.
- **Vendor** — dashboard, product grid, add/edit product form, bulk import, RFQ list + detail, bid
  submission, orders with status timeline, disbursements.
- **Client** — dashboard, catalog with filters, cart, checkout, RFQ list, create RFQ, RFQ detail with
  anonymous bid comparison table, approvals, orders, returns.
- **Delivery** — dashboard, task list, task detail with delivery hash + mock QR, proof of delivery.

### Shared components

`Navbar`, `Sidebar`, `StatusBadge`, `DataTable`, `DetailDrawer`, `StatsCard`, `OrderTimeline`,
`PriceDisplay`.

### Frontend design decisions

- **Role switcher** — React context in the root layout. Drives navbar identity, sidebar links, and
  which portal is reachable. No middleware, no auth.
- **RTL** — the same context toggles `dir` and `lang` on `<html>`. All spacing uses Tailwind logical
  properties (`ms-`/`me-`/`ps-`/`pe-`) so RTL actually mirrors rather than looking broken.
- **`StatusBadge`** — one lookup table maps roughly 45 distinct enum values across 12 tables to the
  pastel semantic palette (emerald / amber / rose / sky / zinc). Raw saturated Tailwind color classes
  such as `bg-red-500` appear nowhere in the codebase.
- **shadcn customization** — indigo primary, `rounded-md` maximum, `border-zinc-200`, `shadow-sm`.
  Never the stock shadcn look.
- **Motion** — Framer Motion on drawer slide, modal open/close, tab switch, and list item
  mount/unmount, with `AnimatePresence` for exits. 150–250ms, ease-out.
- **Bilingual forms** — AR and EN field pairs side by side on every create/edit form.
- **Mock data** — typed against the Prisma-derived shapes so Phase 3 wiring is mechanical: 5 vendors
  (mixed statuses), 5 clients, 20 products across 4 categories with vehicle compatibility, 3 open
  RFQs with line items and anonymous bids, 10 orders across statuses, 3 return requests, and
  disbursement records.

---

## Phasing

Each phase is independently reviewable and mergeable, with a review checkpoint between phases.

| Phase | Contents | Done when |
|---|---|---|
| **0** | Rename `partek` → `partek-be`. docker-compose (postgres:16 + redis). `.env.example`. READMEs for both repos. | Both repos have working setup instructions. |
| **1** | Complete Prisma schema (all models above) + migrations + seed. Config, PrismaService, Prisma client extensions. Auth (register / login / refresh / logout). `JwtAuthGuard` global + `RolesGuard`. `@CurrentUser` / `@Roles` / `@Public`. Users, **Audit**, **Notifications** modules. Swagger at `/api`. Global filter, interceptors, pipes. BullMQ queues registered with stub processors. Storage stub. | App boots, `/api` docs render, DB migrated and seeded, full auth cycle works, audit append-only enforcement is tested. |
| **2** | `partek-fe`: all four portals, ~29 pages, shared component library, mock data, role switcher, RTL toggle. | Every route renders and is navigable; RTL toggle mirrors correctly. |
| **3a** | Vendors, Clients, Locations, DocumentTypes, VendorDocuments. | Onboarding and approval flows work end to end. |
| **3b** | Categories, Brands, VehicleMakes, VehicleModels, Vehicles, Products, ProductImport with real processor. | Catalog CRUD plus a working CSV import producing an error report. |
| **3c** | Carts, RFQs, Bids, PurchaseOrders, Orders. | Both purchase paths reach a created order; anonymity e2e test passes. |
| **3d** | Payments, Disbursements, ZATCA, Delivery, Returns. | Delivery triggers disbursement; ZATCA lifecycle including retry works against the stub. |

**Audit and Notifications are in Phase 1, not last.** Every later service calls them, so they cannot
be built at the end.

---

## Testing

- **Unit** — services tested against mocked repositories. Every rule in the *Business Rule
  Enforcement* table gets a test.
- **Integration** — repository tests against a real Postgres from docker-compose, covering the raw
  SQL constraints (partial unique index, CHECK constraints, audit trigger). These cannot be verified
  with mocks.
- **E2E** — the auth cycle, the bid-anonymity guarantee, and one full pass down each purchase path
  (RFQ and direct).

The bid-anonymity e2e test is non-negotiable and lands with Phase 3c.

---

## Error Handling

- Global exception filter converts Prisma errors to typed HTTP responses; `P2002` (unique violation)
  becomes 409, `P2025` (not found) becomes 404.
- Raw SQL CHECK constraint violations map to 422 with the constraint name in a machine-readable
  field.
- Bilingual error messages (AR/EN) on validation failures, since the frontend is bilingual.
- Stub services (storage, PSP, ZATCA) fail loudly and identifiably rather than silently succeeding,
  so a missing real implementation cannot reach production unnoticed.

---

## Out of Scope

- Real S3, PSP, and ZATCA credentials or network calls. All three are interface-plus-stub.
- Frontend-to-backend wiring. Phase 2 is mock data only.
- Invite-only RFQs (`rfq_invited_vendors`).
- A `platform_settings` table; platform fee resolves through vendor override → config default.
- Monorepo tooling and a shared types package between the two repos.
- Production deployment, CI/CD, and Kubernetes manifests.
