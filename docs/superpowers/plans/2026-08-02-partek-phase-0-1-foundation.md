# Partek Phase 0 + 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the half-built `partek` scaffold to a booting NestJS API with the complete Partek database schema migrated, a working access/refresh auth cycle, global role-based guards, and the three cross-cutting modules (Users, Audit, Notifications) that every later domain depends on.

**Architecture:** NestJS 11 with a repository-per-module boundary over Prisma 7 — services never import `PrismaService`, only their own repository. Prisma 7 runs through the `pg` driver adapter with `moduleFormat = "cjs"` so the project stays CommonJS. The `audit_logs` append-only guarantee is enforced twice: a Prisma client extension that throws on mutation, and a Postgres trigger that catches anything bypassing the ORM.

**Tech Stack:** NestJS 11, TypeScript 5.9, Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`), PostgreSQL 16, Redis 7, BullMQ 6, Passport JWT, class-validator, `@nestjs/swagger` 11, Jest + ts-jest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-02-partek-platform-design.md`. Every requirement in it is binding.
- **Node:** v20+ required by NestJS 11. Local machine is on v24.16.0.
- **Primary keys:** UUID everywhere — `@id @default(uuid()) @db.Uuid`. No `cuid()`.
- **Naming:** `snake_case` columns and tables in Postgres via `@map` / `@@map`; `camelCase` in TypeScript.
- **Prisma generator:** `provider = "prisma-client"`, `output = "../generated/prisma"`, `moduleFormat = "cjs"`. The `output` field is mandatory in Prisma 7 and the client is no longer emitted into `node_modules`.
- **Prisma client import:** always via the `@prisma-client` tsconfig path alias, never a relative path into `generated/`.
- **Repository boundary:** `PrismaService` may be imported *only* by files named `*.repository.ts` and by `database/`. Services receive repositories through DI.
- **Money:** `Decimal` in Prisma, never `Float`. Amounts are `@db.Decimal(12, 2)` for totals and `@db.Decimal(10, 2)` for unit prices, exactly as the spec table list specifies.
- **VAT:** 15%, read from config. Never hard-coded at a call site.
- **Postgres port:** 5434 on the host. 5433 is already taken by the running `foodapp-db` container.
- **Frontend port:** 3001, so `partek-fe` and the API can run simultaneously.
- **Commits:** conventional commits, one per task minimum. Every commit message ends with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.
- **No placeholder secrets in `.env.example`** — use obviously-fake values that will fail loudly if shipped.

---

## File Structure

Phase 0 restructures the existing `src/common/{config,prisma}` layout into the spec's layout, where `config/` and `database/` are top-level under `src/`.

| Path | Responsibility |
|---|---|
| `docker-compose.yml` | Postgres 16 on 5434, Redis 7 on 6379. Dev only. |
| `prisma.config.ts` | Prisma 7 CLI config — schema path, migrations path, seed command, datasource URL. |
| `prisma/schema.prisma` | All 42 models and 23 enums. |
| `prisma/migrations/*_raw_constraints/migration.sql` | Hand-written CHECK constraints, partial unique index, audit trigger. Prisma cannot express these. |
| `prisma/seed.ts` | Deterministic dev seed. |
| `src/main.ts` | Bootstrap: global pipes, filter, Swagger, CORS, port. |
| `src/app.module.ts` | Root module; registers global `APP_GUARD`s. |
| `src/config/configuration.ts` | Typed config factory. |
| `src/config/config.schema.ts` | Joi-free manual env validation that fails fast at boot. |
| `src/database/prisma.service.ts` | `PrismaClient` subclass wired to the `pg` adapter. |
| `src/database/prisma.module.ts` | `@Global()` module exporting `PrismaService`. |
| `src/database/extensions/audit-append-only.extension.ts` | Throws on any `AuditLog` mutation. |
| `src/common/decorators/{public,current-user,roles}.decorator.ts` | Route metadata and param extraction. |
| `src/common/guards/{jwt-auth,roles}.guard.ts` | Global auth and role gates. |
| `src/common/filters/all-exceptions.filter.ts` | Prisma → HTTP error mapping, bilingual messages. |
| `src/common/storage/storage.service.ts` | `IStorageService` interface + stub implementation. |
| `src/auth/**` | Register, login, refresh, logout, JWT strategy, token repository. |
| `src/users/**` | User CRUD and role management. |
| `src/audit/**` | Append-only log service. Insert + read only. |
| `src/notifications/**` | Per-user bilingual notifications. |
| `src/queues/queues.module.ts` | BullMQ registration; stub processors. |
| `test/auth.e2e-spec.ts` | Full auth cycle against a real database. |

---

## Task 1: Rename repo, upgrade toolchain, restructure source

**Files:**
- Move: `/home/daqqaq/repos/partek` → `/home/daqqaq/repos/partek-be`
- Modify: `package.json`
- Move: `src/common/config/configuration.ts` → `src/config/configuration.ts`
- Move: `src/common/prisma/prisma.service.ts` → `src/database/prisma.service.ts`
- Move: `src/common/prisma/prisma.module.ts` → `src/database/prisma.module.ts`
- Delete: `src/common/prisma/prisma.service.spec.ts` (rewritten in Task 10)
- Move: `src/modules/auth/dto/` → `src/auth/dto/`
- Modify: `tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing — this is the first task.
- Produces: the directory layout every later task writes into; the `@/*` and `@prisma-client` tsconfig aliases.

- [ ] **Step 1: Rename the repository directory**

```bash
cd /home/daqqaq/repos
mv partek partek-be
cd partek-be
```

All later steps run from `/home/daqqaq/repos/partek-be`.

- [ ] **Step 2: Upgrade dependencies to NestJS 11 + Prisma 7**

```bash
npm install \
  @nestjs/common@^11.1.28 @nestjs/core@^11.1.28 @nestjs/platform-express@^11.1.28 \
  @nestjs/config@^4.0.4 @nestjs/jwt@^11.0.2 @nestjs/passport@^11.0.5 \
  @nestjs/swagger@^11.4.6 @nestjs/mapped-types@^2.1.1 @nestjs/bullmq@^11.0.4 \
  @prisma/client@^7.9.1 @prisma/adapter-pg@^7.9.1 \
  bullmq@^5.81.3 bcrypt@^5.1.1 class-validator@^0.14.1 class-transformer@^0.5.1 \
  passport@^0.7.0 passport-jwt@^4.0.1 reflect-metadata@^0.2.2 rxjs@^7.8.1 \
  date-fns@^3.6.0 swagger-ui-express@^5.0.1 dotenv@^16.4.5

npm install -D \
  @nestjs/cli@^11.0.24 @nestjs/schematics@^11.0.0 @nestjs/testing@^11.1.28 \
  prisma@^7.9.1 tsx@^4.19.2 \
  @types/bcrypt@^5.0.2 @types/express@^5.0.0 @types/jest@^29.5.14 \
  @types/node@^22.10.0 @types/passport-jwt@^4.0.1 @types/supertest@^6.0.2 \
  jest@^29.7.0 supertest@^7.0.0 ts-jest@^29.2.5 ts-loader@^9.5.1 \
  tsconfig-paths@^4.2.0 typescript@^5.9.3 source-map-support@^0.5.21
```

`@prisma/adapter-pg` pulls in the `pg` driver itself — do not install `pg` separately.

`bullmq` is pinned to `^5.81.3`, not the newer `6.x`. `@nestjs/bullmq@11.0.4` is the
newest release of the Nest wrapper and its peer range is `bullmq: ^3 || ^4 || ^5`, so
`bullmq@6` cannot be installed alongside it without `--legacy-peer-deps`. Forcing it would
put an unsupported major under the `Processor` / `WorkerHost` API that Task 19's four
processors are built on. Revisit when `@nestjs/bullmq` widens its peer range.

- [ ] **Step 3: Restructure directories**

```bash
mkdir -p src/config src/database/extensions src/common/{decorators,guards,filters,interceptors,pipes,storage} src/auth/dto src/queues
git mv src/common/config/configuration.ts src/config/configuration.ts
git mv src/common/prisma/prisma.service.ts src/database/prisma.service.ts
git mv src/common/prisma/prisma.module.ts src/database/prisma.module.ts
git rm src/common/prisma/prisma.service.spec.ts
git mv src/modules/auth/dto/login.dto.ts src/auth/dto/login.dto.ts
git mv src/modules/auth/dto/register.dto.ts src/auth/dto/register.dto.ts
git mv src/modules/auth/dto/register.dto.spec.ts src/auth/dto/register.dto.spec.ts
rmdir -p src/common/config src/common/prisma src/modules/auth/dto 2>/dev/null || true
```

The `register.dto.ts` / `login.dto.ts` / `register.dto.spec.ts` files carry over unchanged — they are already correct.

- [ ] **Step 4: Rewrite `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "paths": {
      "@/*": ["src/*"],
      "@prisma-client": ["generated/prisma/client"]
    }
  },
  "include": ["src/**/*", "prisma/**/*", "generated/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Update `package.json` scripts and Jest config**

Replace the `scripts` and `jest` blocks with:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": ".",
    "roots": ["<rootDir>/src"],
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["src/**/*.(t|j)s"],
    "coverageDirectory": "./coverage",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1",
      "^@prisma-client$": "<rootDir>/generated/prisma/client"
    }
  }
}
```

`rootDir` moves from `src` to `.` so Jest can resolve the generated client outside `src`.

- [ ] **Step 6: Update `.gitignore`**

```
/dist
/node_modules
/coverage
/generated
.env
*.log
.DS_Store
```

- [ ] **Step 7: Verify the toolchain installs and typechecks**

Run: `npx tsc --noEmit`
Expected: errors only about the missing `@prisma-client` module (no client generated yet) and the missing `main.ts`. No errors about NestJS APIs. If NestJS 11 reports breaking-change errors in `jwt-auth.guard.ts`, fix them now — the guard's `Reflector.getAllAndOverride` API is unchanged in v11, so no errors are expected there.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: rename to partek-be, upgrade to NestJS 11 + Prisma 7, restructure src

Moves config/ and database/ to top level per the platform spec, adds the
@/* and @prisma-client path aliases, and moves Jest rootDir to the repo
root so the out-of-src generated Prisma client resolves.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Docker services, environment, and Prisma 7 wiring

**Files:**
- Create: `docker-compose.yml`
- Create: `prisma.config.ts`
- Modify: `.env.example`
- Modify: `.env`
- Modify: `prisma/schema.prisma`
- Modify: `src/database/prisma.service.ts`
- Modify: `src/database/prisma.module.ts`

**Interfaces:**
- Consumes: the directory layout from Task 1.
- Produces: `PrismaService` (an injectable `PrismaClient` bound to the `pg` adapter) and a reachable Postgres on `localhost:5434`. Every repository in every later task injects `PrismaService`.

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: partek-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: partek
      POSTGRES_PASSWORD: partek
      POSTGRES_DB: partek
    ports:
      - '5434:5432'
    volumes:
      - partek-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U partek -d partek']
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: partek-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - partek-redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  partek-pgdata:
  partek-redisdata:
```

Port 5434 is deliberate — 5433 is occupied by the unrelated `foodapp-db` container on this machine.

- [ ] **Step 2: Write `.env.example`**

```
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:3001

DATABASE_URL=postgresql://partek:partek@localhost:5434/partek?schema=public

JWT_ACCESS_SECRET=replace-me-access-secret-do-not-ship
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace-me-refresh-secret-do-not-ship
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

REDIS_HOST=localhost
REDIS_PORT=6379

STORAGE_DRIVER=stub
S3_BUCKET=partek-dev
S3_REGION=me-south-1
S3_ENDPOINT=

VAT_RATE=0.15
DEFAULT_PLATFORM_FEE_PCT=5
CART_PRICE_LOCK_HOURS=48
```

Copy the same content to `.env`, replacing the two JWT secrets with real random values from `openssl rand -hex 32`. `.env` is gitignored.

- [ ] **Step 3: Create `prisma.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

Prisma 7 no longer reads `.env` implicitly, which is why `dotenv/config` is imported explicitly.

- [ ] **Step 4: Replace the generator and datasource block in `prisma/schema.prisma`**

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}
```

**The datasource block carries no `url`.** In Prisma 7, when the connection is supplied
through `prisma.config.ts` (`datasource: { url: env("DATABASE_URL") }`) and queries run via a
driver adapter, a `url` in the schema's datasource block is rejected outright — `prisma
generate` fails with P1012. The URL lives in exactly one place: `prisma.config.ts` for the
CLI, and `PrismaPg` in `prisma.service.ts` for the runtime client.

Delete the existing `model User { ... }` block entirely — it uses `cuid()` and is replaced wholesale in Task 3.

`moduleFormat = "cjs"` is what keeps this project on CommonJS. Without it Prisma 7 emits ESM and forces `"type": "module"` in `package.json`, which breaks NestJS decorator emit and ts-jest.

- [ ] **Step 5: Rewrite `src/database/prisma.service.ts`**

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma-client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL as string,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`onModuleDestroy` matters here: without it, Jest e2e runs leak connections and hang instead of exiting.

- [ ] **Step 6: Rewrite `src/database/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 7: Start the services and verify Postgres accepts connections**

```bash
npm run db:up
docker compose ps
```

Expected: both `partek-db` and `partek-redis` report `healthy`. If `partek-db` is unhealthy, check that nothing else holds 5434.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add docker services and wire Prisma 7 with the pg driver adapter

Postgres on 5434 to avoid the existing foodapp-db on 5433. Pins the
generator to moduleFormat=cjs so the project stays CommonJS rather than
being forced to ESM by Prisma 7's default.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Schema — enums and the Users/Auth domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_init_users_auth/` (generated)

**Interfaces:**
- Consumes: the generator and datasource blocks from Task 2.
- Produces: every enum used across the whole schema, plus the `User` and `RefreshToken` models. Tasks 4–7 append models that reference `User` by `@relation`.

All enums land in this task even though most are consumed later, so that Tasks 4–7 never have to edit an earlier task's block.

- [ ] **Step 1: Append all platform enums to `prisma/schema.prisma`**

```prisma
enum UserRole {
  admin
  vendor
  client
  delivery_agent
}

enum UserStatus {
  active
  inactive
  suspended
}

enum Language {
  ar
  en
}

enum VendorStatus {
  pending
  approved
  rejected
  info_required
  suspended
}

enum ClientStatus {
  pending
  approved
  rejected
  suspended
}

enum OrgRole {
  submitter
  approver
  escalation_manager
}

enum BrandType {
  oem
  aftermarket
}

enum ImportJobStatus {
  pending
  processing
  completed
  failed
  partial
}

enum CartStatus {
  active
  converted
  abandoned
}

enum Incoterm {
  exw
  d2d
}

enum StockStatus {
  in_stock
  out_of_stock
}

enum RfqStatus {
  draft
  open
  closed
  awarded
  cancelled
  expired
}

enum BidStatus {
  submitted
  awarded
  rejected
  withdrawn
}

enum PoSourceType {
  rfq
  direct
}

enum PoStatus {
  pending
  approved
  rejected
  confirmed
  cancelled
}

enum OrderStatus {
  pending
  confirmed
  preparing
  ready_pickup
  in_transit
  delivered
  completed
  returned
  cancelled
}

enum PaymentType {
  collection
  refund
}

enum PaymentStatus {
  initiated
  succeeded
  failed
}

enum DisbursementStatus {
  pending
  initiated
  completed
  failed
}

enum DeliveryTaskStatus {
  assigned
  pickup_confirmed
  in_transit
  delivered
  failed
}

enum ZatcaInvoiceType {
  standard
  credit_note
}

enum ZatcaSubmissionStatus {
  pending
  submitted
  accepted
  rejected
  retry
}

enum ReturnStatus {
  requested
  under_review
  approved
  rejected
  pickup_scheduled
  received
  refunded
}
```

- [ ] **Step 2: Append the `User` and `RefreshToken` models**

```prisma
model User {
  id                String     @id @default(uuid()) @db.Uuid
  email             String     @unique
  passwordHash      String     @map("password_hash")
  phone             String?
  role              UserRole
  status            UserStatus @default(active)
  preferredLanguage Language   @default(en) @map("preferred_language")
  lastLoginAt       DateTime?  @map("last_login_at")
  createdAt         DateTime   @default(now()) @map("created_at")
  updatedAt         DateTime   @updatedAt @map("updated_at")

  refreshTokens RefreshToken[]

  @@index([role, status])
  @@map("users")
}

model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  userAgent String?   @map("user_agent")
  ipAddress String?   @map("ip_address")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@map("refresh_tokens")
}
```

`RefreshToken` is the spec's first schema addition. Without it, logout cannot invalidate anything.

- [ ] **Step 3: Generate the client and run the first migration**

```bash
npx prisma generate
npx prisma migrate dev --name init_users_auth
```

Expected: `generated/prisma/` is created, and `users` + `refresh_tokens` exist in Postgres.

- [ ] **Step 4: Verify the generated client typechecks**

Run: `npx tsc --noEmit`
Expected: no errors from `src/database/prisma.service.ts`. The `@prisma-client` alias now resolves. Errors about the missing `src/main.ts` are still expected.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add platform enums, User and RefreshToken models

Adds refresh_tokens, which the source requirements omitted -- logout is a
no-op without server-side token invalidation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Schema — Vendor, Client, and Location domains

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_vendor_client_location/` (generated)

**Interfaces:**
- Consumes: `User`, `VendorStatus`, `ClientStatus`, `OrgRole` from Task 3.
- Produces: `Vendor`, `Client`, `ClientUser`, `Location`, `DocumentType`, `VendorDocument`, and the two join models. Tasks 5–7 reference `Vendor.id`, `Client.id`, and `ClientUser.id`.

- [ ] **Step 1: Append the vendor, client, and location models**

```prisma
model Vendor {
  id              String       @id @default(uuid()) @db.Uuid
  userId          String       @map("user_id") @db.Uuid
  companyNameAr   String       @map("company_name_ar")
  companyNameEn   String       @map("company_name_en")
  crNumber        String       @unique @map("cr_number")
  vatNumber       String?      @map("vat_number")
  status          VendorStatus @default(pending)
  approvedBy      String?      @map("approved_by") @db.Uuid
  approvedAt      DateTime?    @map("approved_at")
  rejectionReason String?      @map("rejection_reason")
  platformFeePct  Decimal?     @map("platform_fee_pct") @db.Decimal(5, 2)
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  documents VendorDocument[]
  locations VendorLocation[]

  @@index([status])
  @@map("vendors")
}

model DocumentType {
  id         String  @id @default(uuid()) @db.Uuid
  nameAr     String  @map("name_ar")
  nameEn     String  @map("name_en")
  isRequired Boolean @default(false) @map("is_required")
  isActive   Boolean @default(true) @map("is_active")

  documents VendorDocument[]

  @@map("document_types")
}

model VendorDocument {
  id             String    @id @default(uuid()) @db.Uuid
  vendorId       String    @map("vendor_id") @db.Uuid
  documentTypeId String    @map("document_type_id") @db.Uuid
  fileUrl        String    @map("file_url")
  expiryDate     DateTime? @map("expiry_date")
  isValid        Boolean   @default(false) @map("is_valid")
  uploadedBy     String    @map("uploaded_by") @db.Uuid
  validatedBy    String?   @map("validated_by") @db.Uuid
  uploadedAt     DateTime  @default(now()) @map("uploaded_at")

  vendor       Vendor       @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  documentType DocumentType @relation(fields: [documentTypeId], references: [id])

  @@index([vendorId])
  @@map("vendor_documents")
}

model Location {
  id          String  @id @default(uuid()) @db.Uuid
  name        String
  addressLine String  @map("address_line")
  lat         Decimal @db.Decimal(10, 7)
  lng         Decimal @db.Decimal(10, 7)

  vendorLocations VendorLocation[]
  clientLocations ClientLocation[]

  @@map("locations")
}

model VendorLocation {
  id         String @id @default(uuid()) @db.Uuid
  vendorId   String @map("vendor_id") @db.Uuid
  locationId String @map("location_id") @db.Uuid

  vendor   Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([vendorId, locationId])
  @@map("vendor_locations")
}

model Client {
  id              String       @id @default(uuid()) @db.Uuid
  companyNameAr   String       @map("company_name_ar")
  companyNameEn   String       @map("company_name_en")
  crNumber        String       @unique @map("cr_number")
  vatNumber       String?      @map("vat_number")
  status          ClientStatus @default(pending)
  approvedBy      String?      @map("approved_by") @db.Uuid
  approvedAt      DateTime?    @map("approved_at")
  rejectionReason String?      @map("rejection_reason")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  clientUsers ClientUser[]
  locations   ClientLocation[]

  @@index([status])
  @@map("clients")
}

model ClientUser {
  id        String   @id @default(uuid()) @db.Uuid
  clientId  String   @map("client_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  orgRole   OrgRole  @map("org_role")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, userId])
  @@map("client_users")
}

model ClientLocation {
  id         String @id @default(uuid()) @db.Uuid
  clientId   String @map("client_id") @db.Uuid
  locationId String @map("location_id") @db.Uuid

  client   Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([clientId, locationId])
  @@map("client_locations")
}
```

`Vendor.userId`, `Vendor.approvedBy`, `VendorDocument.uploadedBy`, `VendorDocument.validatedBy`, `Client.approvedBy`, and `ClientUser.userId` are intentionally plain `@db.Uuid` columns rather than Prisma relations. Declaring six named back-relations on `User` for fields that are only ever read by ID adds noise to every `User` query for no benefit. Referential integrity for these is added as foreign keys in Task 8.

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name vendor_client_location
```

Expected: eight new tables. No errors.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): add vendor, client, and location domains

Adds vendors.platform_fee_pct as the per-vendor override the
disbursement fee calculation needs; the source requirements gave
platform_fee_pct no origin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Schema — Catalog domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_catalog/` (generated)

**Interfaces:**
- Consumes: `Vendor` from Task 4; `BrandType`, `ImportJobStatus` from Task 3.
- Produces: `Category`, `VehicleMake`, `VehicleModel`, `Vehicle`, `Brand`, `Product`, `PartNumber`, `ProductImage`, `ProductVehicleCompatibility`, `ProductImportJob`. Tasks 6–7 reference `Product.id` and `Vehicle.id`.

- [ ] **Step 1: Append the catalog models**

```prisma
model Category {
  id        String   @id @default(uuid()) @db.Uuid
  nameAr    String   @map("name_ar")
  nameEn    String   @map("name_en")
  parentId  String?  @map("parent_id") @db.Uuid
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]

  @@index([parentId])
  @@map("categories")
}

model VehicleMake {
  id      String  @id @default(uuid()) @db.Uuid
  nameAr  String  @map("name_ar")
  nameEn  String  @map("name_en")
  logoUrl String? @map("logo_url")

  models   VehicleModel[]
  vehicles Vehicle[]

  @@map("vehicle_makes")
}

model VehicleModel {
  id     String @id @default(uuid()) @db.Uuid
  makeId String @map("make_id") @db.Uuid
  nameAr String @map("name_ar")
  nameEn String @map("name_en")

  make     VehicleMake @relation(fields: [makeId], references: [id], onDelete: Cascade)
  vehicles Vehicle[]

  @@index([makeId])
  @@map("vehicle_models")
}

model Vehicle {
  id      String  @id @default(uuid()) @db.Uuid
  makeId  String  @map("make_id") @db.Uuid
  modelId String  @map("model_id") @db.Uuid
  trim    String?
  year    Int     @db.SmallInt
  vin     String?

  make          VehicleMake                   @relation(fields: [makeId], references: [id])
  model         VehicleModel                  @relation(fields: [modelId], references: [id])
  compatibility ProductVehicleCompatibility[]
  rfqLineItems  RfqLineItem[]

  @@index([makeId, modelId, year])
  @@map("vehicles")
}

model Brand {
  id        String    @id @default(uuid()) @db.Uuid
  nameAr    String    @map("name_ar")
  nameEn    String    @map("name_en")
  brandType BrandType @map("brand_type")

  products Product[]

  @@map("brands")
}

model Product {
  id               String   @id @default(uuid()) @db.Uuid
  vendorId         String   @map("vendor_id") @db.Uuid
  categoryId       String   @map("category_id") @db.Uuid
  brandId          String?  @map("brand_id") @db.Uuid
  oemPartNumber    String?  @map("oem_part_number")
  nameAr           String   @map("name_ar")
  nameEn           String   @map("name_en")
  descriptionAr    String?  @map("description_ar")
  descriptionEn    String?  @map("description_en")
  exwPriceSar      Decimal? @map("exw_price_sar") @db.Decimal(10, 2)
  d2dPriceSar      Decimal? @map("d2d_price_sar") @db.Decimal(10, 2)
  stockQuantity    Int      @default(0) @map("stock_quantity")
  weightKg         Decimal? @map("weight_kg") @db.Decimal(10, 3)
  lengthCm         Decimal? @map("length_cm") @db.Decimal(10, 2)
  widthCm          Decimal? @map("width_cm") @db.Decimal(10, 2)
  heightCm         Decimal? @map("height_cm") @db.Decimal(10, 2)
  isActive         Boolean  @default(true) @map("is_active")
  qualityValidated Boolean  @default(false) @map("quality_validated")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  category      Category                      @relation(fields: [categoryId], references: [id])
  brand         Brand?                        @relation(fields: [brandId], references: [id])
  partNumbers   PartNumber[]
  images        ProductImage[]
  compatibility ProductVehicleCompatibility[]
  cartItems     CartItem[]
  rfqLineItems  RfqLineItem[]
  bidLineItems  BidLineItem[]
  poLineItems   PoLineItem[]

  @@index([vendorId, isActive])
  @@index([categoryId])
  @@index([oemPartNumber])
  @@map("products")
}

model PartNumber {
  id         String @id @default(uuid()) @db.Uuid
  productId  String @map("product_id") @db.Uuid
  partNumber String @map("part_number")
  source     String

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([partNumber])
  @@map("part_numbers")
}

model ProductImage {
  id        String   @id @default(uuid()) @db.Uuid
  productId String   @map("product_id") @db.Uuid
  imageUrl  String   @map("image_url")
  isHero    Boolean  @default(false) @map("is_hero")
  sortOrder Int      @default(0) @map("sort_order") @db.SmallInt
  createdAt DateTime @default(now()) @map("created_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("product_images")
}

model ProductVehicleCompatibility {
  id        String @id @default(uuid()) @db.Uuid
  productId String @map("product_id") @db.Uuid
  vehicleId String @map("vehicle_id") @db.Uuid

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  vehicle Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  @@unique([productId, vehicleId])
  @@map("product_vehicle_compatibility")
}

model ProductImportJob {
  id             String          @id @default(uuid()) @db.Uuid
  vendorId       String          @map("vendor_id") @db.Uuid
  uploadedBy     String          @map("uploaded_by") @db.Uuid
  fileUrl        String          @map("file_url")
  status         ImportJobStatus @default(pending)
  totalRows      Int             @default(0) @map("total_rows")
  succeededRows  Int             @default(0) @map("succeeded_rows")
  failedRows     Int             @default(0) @map("failed_rows")
  errorReportUrl String?         @map("error_report_url")
  startedAt      DateTime?       @map("started_at")
  completedAt    DateTime?       @map("completed_at")
  createdAt      DateTime        @default(now()) @map("created_at")

  @@index([vendorId, status])
  @@map("product_import_jobs")
}
```

The `@@index([makeId, modelId, year])` on `Vehicle` exists specifically for the import resolver, which looks vehicles up by make + model + year on every row.

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name catalog
```

Expected: ten new tables. The `Product` model references `CartItem`, `RfqLineItem`, `BidLineItem`, and `PoLineItem`, which do not exist yet — **this will fail validation.** Remove those four back-relation lines from `Product` and the `rfqLineItems` line from `Vehicle` before migrating, then restore them in Task 6 Step 1 where their counterparts are defined.

- [ ] **Step 3: Verify**

Run: `npx prisma validate && npx tsc --noEmit`
Expected: "The schema is valid" and no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): add catalog domain

Indexes vehicles on (make_id, model_id, year) for the bulk import
resolver, which matches on exactly those three fields per row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Schema — Cart, RFQ, Bid, and snapshot domains

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_cart_rfq_bid/` (generated)

**Interfaces:**
- Consumes: `Client`, `ClientUser` from Task 4; `Product`, `Vehicle` from Task 5.
- Produces: `Cart`, `CartItem`, `Rfq`, `RfqLineItem`, `Bid`, `BidLineItem`, `BidAwardSnapshot`. Task 7 references `Bid.id` and `BidAwardSnapshot.id`.

- [ ] **Step 1: Restore the deferred back-relations from Task 5**

Add back to `model Product`:

```prisma
  cartItems     CartItem[]
  rfqLineItems  RfqLineItem[]
  bidLineItems  BidLineItem[]
  poLineItems   PoLineItem[]
```

Add back to `model Vehicle`:

```prisma
  rfqLineItems RfqLineItem[]
```

`PoLineItem` is defined in Task 7, so leave the `poLineItems` line commented out until then.

- [ ] **Step 2: Append the cart, RFQ, and bid models**

```prisma
model Cart {
  id           String     @id @default(uuid()) @db.Uuid
  clientId     String     @map("client_id") @db.Uuid
  clientUserId String     @map("client_user_id") @db.Uuid
  status       CartStatus @default(active)
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  items CartItem[]

  @@index([clientId, status])
  @@map("carts")
}

model CartItem {
  id                    String      @id @default(uuid()) @db.Uuid
  cartId                String      @map("cart_id") @db.Uuid
  productId             String      @map("product_id") @db.Uuid
  vendorId              String      @map("vendor_id") @db.Uuid
  quantity              Int
  selectedIncoterm      Incoterm    @map("selected_incoterm")
  unitPriceSnapshotSar  Decimal     @map("unit_price_snapshot_sar") @db.Decimal(10, 2)
  addedAt               DateTime    @default(now()) @map("added_at")
  priceLockedUntil      DateTime    @map("price_locked_until")
  isStale               Boolean     @default(false) @map("is_stale")
  stockStatus           StockStatus @default(in_stock) @map("stock_status")

  cart    Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@index([cartId])
  @@index([priceLockedUntil])
  @@map("cart_items")
}

model Rfq {
  id                   String    @id @default(uuid()) @db.Uuid
  clientId             String    @map("client_id") @db.Uuid
  createdBy            String    @map("created_by") @db.Uuid
  rfqNumber            String    @unique @map("rfq_number")
  preferredDeliveryDate DateTime @map("preferred_delivery_date")
  bidDeadline          DateTime  @map("bid_deadline")
  status               RfqStatus @default(draft)
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  lineItems RfqLineItem[]
  bids      Bid[]
  awards    BidAwardSnapshot[]

  @@index([status, bidDeadline])
  @@index([clientId])
  @@map("rfqs")
}

model RfqLineItem {
  id              String  @id @default(uuid()) @db.Uuid
  rfqId           String  @map("rfq_id") @db.Uuid
  vehicleId       String? @map("vehicle_id") @db.Uuid
  productId       String? @map("product_id") @db.Uuid
  partDescription String  @map("part_description")
  quantity        Int
  specifications  String?

  rfq          Rfq           @relation(fields: [rfqId], references: [id], onDelete: Cascade)
  vehicle      Vehicle?      @relation(fields: [vehicleId], references: [id])
  product      Product?      @relation(fields: [productId], references: [id])
  bidLineItems BidLineItem[]

  @@index([rfqId])
  @@map("rfq_line_items")
}

model Bid {
  id                    String    @id @default(uuid()) @db.Uuid
  rfqId                 String    @map("rfq_id") @db.Uuid
  vendorId              String    @map("vendor_id") @db.Uuid
  anonymousLabel        String    @map("anonymous_label")
  incoterm              Incoterm
  estimatedDeliveryDays Int       @map("estimated_delivery_days")
  notes                 String?
  status                BidStatus @default(submitted)
  submittedAt           DateTime  @default(now()) @map("submitted_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  rfq       Rfq                @relation(fields: [rfqId], references: [id], onDelete: Cascade)
  lineItems BidLineItem[]
  awards    BidAwardSnapshot[]

  @@unique([rfqId, vendorId])
  @@unique([rfqId, anonymousLabel])
  @@index([vendorId, status])
  @@map("bids")
}

model BidLineItem {
  id                String  @id @default(uuid()) @db.Uuid
  bidId             String  @map("bid_id") @db.Uuid
  rfqLineItemId     String  @map("rfq_line_item_id") @db.Uuid
  productId         String? @map("product_id") @db.Uuid
  exwUnitPriceSar   Decimal @map("exw_unit_price_sar") @db.Decimal(10, 2)
  d2dUnitPriceSar   Decimal @map("d2d_unit_price_sar") @db.Decimal(10, 2)
  quantityAvailable Int     @map("quantity_available")

  bid         Bid          @relation(fields: [bidId], references: [id], onDelete: Cascade)
  rfqLineItem RfqLineItem  @relation(fields: [rfqLineItemId], references: [id], onDelete: Cascade)
  product     Product?     @relation(fields: [productId], references: [id])
  poLineItems PoLineItem[]

  @@index([bidId])
  @@map("bid_line_items")
}

model BidAwardSnapshot {
  id               String   @id @default(uuid()) @db.Uuid
  bidId            String   @map("bid_id") @db.Uuid
  rfqId            String   @map("rfq_id") @db.Uuid
  clientId         String   @map("client_id") @db.Uuid
  vendorId         String   @map("vendor_id") @db.Uuid
  selectedIncoterm Incoterm @map("selected_incoterm")
  totalAmountSar   Decimal  @map("total_amount_sar") @db.Decimal(12, 2)
  lineItemsJson    Json     @map("line_items_json")
  awardedAt        DateTime @default(now()) @map("awarded_at")
  awardedBy        String   @map("awarded_by") @db.Uuid

  bid Bid @relation(fields: [bidId], references: [id])
  rfq Rfq @relation(fields: [rfqId], references: [id])

  @@index([rfqId])
  @@map("bid_award_snapshots")
}
```

Two unique constraints on `Bid` matter. `@@unique([rfqId, vendorId])` is the spec's third schema addition — one bid per vendor per RFQ, revised by update. `@@unique([rfqId, anonymousLabel])` is what makes the label allocator in Phase 3c safe under concurrency: two vendors racing to submit cannot both land "Supplier A".

`BidLineItem.poLineItems` references `PoLineItem` from Task 7 — comment it out until then, along with `Product.poLineItems`.

- [ ] **Step 3: Migrate**

```bash
npx prisma migrate dev --name cart_rfq_bid
```

Expected: seven new tables.

- [ ] **Step 4: Verify**

Run: `npx prisma validate && npx tsc --noEmit`
Expected: "The schema is valid", no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add cart, RFQ, bid, and award snapshot domains

Adds unique (rfq_id, vendor_id) so a vendor revises rather than
duplicates a bid, and unique (rfq_id, anonymous_label) so concurrent
submissions cannot collide on the same Supplier label.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Schema — Order, payment, delivery, compliance, returns, audit, notifications

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_orders_through_notifications/` (generated)

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces: the remaining 15 models. After this task the schema is complete and `npx prisma validate` passes with no commented-out relations.

- [ ] **Step 1: Uncomment the deferred `poLineItems` relations**

Restore `poLineItems PoLineItem[]` on both `model Product` and `model BidLineItem`.

- [ ] **Step 2: Append the order and payment models**

```prisma
model PurchaseOrder {
  id               String       @id @default(uuid()) @db.Uuid
  poNumber         String       @unique @map("po_number")
  sourceType       PoSourceType @map("source_type")
  cartId           String?      @map("cart_id") @db.Uuid
  rfqId            String?      @map("rfq_id") @db.Uuid
  bidId            String?      @map("bid_id") @db.Uuid
  clientId         String       @map("client_id") @db.Uuid
  vendorId         String       @map("vendor_id") @db.Uuid
  createdBy        String       @map("created_by") @db.Uuid
  selectedIncoterm Incoterm     @map("selected_incoterm")
  totalAmountSar   Decimal      @map("total_amount_sar") @db.Decimal(12, 2)
  status           PoStatus     @default(pending)
  approvedBy       String?      @map("approved_by") @db.Uuid
  approvedAt       DateTime?    @map("approved_at")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  lineItems     PoLineItem[]
  confirmations PoConfirmationSnapshot[]
  orders        Order[]

  @@index([clientId, status])
  @@index([vendorId, status])
  @@map("purchase_orders")
}

model PoLineItem {
  id            String  @id @default(uuid()) @db.Uuid
  poId          String  @map("po_id") @db.Uuid
  bidLineItemId String? @map("bid_line_item_id") @db.Uuid
  productId     String? @map("product_id") @db.Uuid
  description   String
  quantity      Int
  unitPriceSar  Decimal @map("unit_price_sar") @db.Decimal(10, 2)
  lineTotalSar  Decimal @map("line_total_sar") @db.Decimal(12, 2)

  purchaseOrder PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  bidLineItem   BidLineItem?  @relation(fields: [bidLineItemId], references: [id])
  product       Product?      @relation(fields: [productId], references: [id])

  @@index([poId])
  @@map("po_line_items")
}

model PoConfirmationSnapshot {
  id                    String   @id @default(uuid()) @db.Uuid
  poId                  String   @map("po_id") @db.Uuid
  bidAwardSnapshotId    String?  @map("bid_award_snapshot_id") @db.Uuid
  selectedIncoterm      Incoterm @map("selected_incoterm")
  totalAmountSar        Decimal  @map("total_amount_sar") @db.Decimal(12, 2)
  vatAmountSar          Decimal  @map("vat_amount_sar") @db.Decimal(10, 2)
  lineItemsJson         Json     @map("line_items_json")
  confirmedAt           DateTime @default(now()) @map("confirmed_at")
  confirmedBy           String   @map("confirmed_by") @db.Uuid

  purchaseOrder PurchaseOrder @relation(fields: [poId], references: [id])

  @@index([poId])
  @@map("po_confirmation_snapshots")
}

model Order {
  id                  String       @id @default(uuid()) @db.Uuid
  orderNumber         String       @unique @map("order_number")
  poId                String       @map("po_id") @db.Uuid
  vendorId            String       @map("vendor_id") @db.Uuid
  clientId            String       @map("client_id") @db.Uuid
  createdBy           String       @map("created_by") @db.Uuid
  sourceType          PoSourceType @map("source_type")
  selectedIncoterm    Incoterm     @map("selected_incoterm")
  status              OrderStatus  @default(pending)
  totalAmountSar      Decimal      @map("total_amount_sar") @db.Decimal(12, 2)
  platformFeeSar      Decimal      @map("platform_fee_sar") @db.Decimal(10, 2)
  netVendorAmountSar  Decimal      @map("net_vendor_amount_sar") @db.Decimal(12, 2)
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")

  purchaseOrder  PurchaseOrder        @relation(fields: [poId], references: [id])
  statusHistory  OrderStatusHistory[]
  payments       Payment[]
  disbursements  VendorDisbursement[]
  deliveryTasks  DeliveryTask[]
  zatcaInvoices  ZatcaInvoice[]
  returnRequests ReturnRequest[]

  @@index([clientId, status])
  @@index([vendorId, status])
  @@map("orders")
}

model OrderStatusHistory {
  id             String      @id @default(uuid()) @db.Uuid
  orderId        String      @map("order_id") @db.Uuid
  previousStatus OrderStatus @map("previous_status")
  newStatus      OrderStatus @map("new_status")
  changedBy      String      @map("changed_by") @db.Uuid
  reason         String?
  changedAt      DateTime    @default(now()) @map("changed_at")

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, changedAt])
  @@map("order_status_history")
}

model Payment {
  id           String        @id @default(uuid()) @db.Uuid
  orderId      String        @map("order_id") @db.Uuid
  paymentType  PaymentType   @map("payment_type")
  amountSar    Decimal       @map("amount_sar") @db.Decimal(12, 2)
  pspReference String        @map("psp_reference")
  pspProvider  String        @map("psp_provider")
  status       PaymentStatus @default(initiated)
  failureCode  String?       @map("failure_code")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  order Order @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@map("payments")
}

model VendorDisbursement {
  id                String             @id @default(uuid()) @db.Uuid
  orderId           String             @map("order_id") @db.Uuid
  vendorId          String             @map("vendor_id") @db.Uuid
  grossAmountSar    Decimal            @map("gross_amount_sar") @db.Decimal(12, 2)
  platformFeeSar    Decimal            @map("platform_fee_sar") @db.Decimal(10, 2)
  platformFeePct    Decimal            @map("platform_fee_pct") @db.Decimal(5, 2)
  netAmountSar      Decimal            @map("net_amount_sar") @db.Decimal(12, 2)
  pspReference      String?            @map("psp_reference")
  status            DisbursementStatus @default(pending)
  settlementDueDate DateTime           @map("settlement_due_date")
  completedAt       DateTime?          @map("completed_at")
  createdAt         DateTime           @default(now()) @map("created_at")

  order    Order                 @relation(fields: [orderId], references: [id])
  invoices PlatformFeeInvoice[]

  @@index([vendorId, status])
  @@map("vendor_disbursements")
}

model PlatformFeeInvoice {
  id             String   @id @default(uuid()) @db.Uuid
  disbursementId String   @map("disbursement_id") @db.Uuid
  vendorId       String   @map("vendor_id") @db.Uuid
  feeAmountSar   Decimal  @map("fee_amount_sar") @db.Decimal(10, 2)
  vatOnFeeSar    Decimal  @map("vat_on_fee_sar") @db.Decimal(10, 2)
  zatcaInvoiceId String?  @map("zatca_invoice_id") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at")

  disbursement VendorDisbursement @relation(fields: [disbursementId], references: [id])
  zatcaInvoice ZatcaInvoice?      @relation(fields: [zatcaInvoiceId], references: [id])

  @@index([vendorId])
  @@map("platform_fee_invoices")
}
```

- [ ] **Step 3: Append the delivery, compliance, returns, audit, and notification models**

```prisma
model DeliveryAgent {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @unique @map("user_id") @db.Uuid
  carrierName String   @map("carrier_name")
  agentCode   String   @unique @map("agent_code")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")

  tasks           DeliveryTask[]
  proofOfDelivery ProofOfDelivery[]

  @@map("delivery_agents")
}

model DeliveryTask {
  id                String             @id @default(uuid()) @db.Uuid
  orderId           String             @map("order_id") @db.Uuid
  agentId           String?            @map("agent_id") @db.Uuid
  deliveryHash      String?            @unique @map("delivery_hash")
  carrierReference  String?            @map("carrier_reference")
  pickupAddress     String             @map("pickup_address")
  deliveryAddress   String             @map("delivery_address")
  itemManifest      Json               @map("item_manifest")
  status            DeliveryTaskStatus @default(assigned)
  assignedBy        String?            @map("assigned_by") @db.Uuid
  estimatedDelivery DateTime           @map("estimated_delivery")
  createdAt         DateTime           @default(now()) @map("created_at")
  updatedAt         DateTime           @updatedAt @map("updated_at")

  order Order            @relation(fields: [orderId], references: [id])
  agent DeliveryAgent?   @relation(fields: [agentId], references: [id])
  proof ProofOfDelivery[]

  @@index([agentId, status])
  @@index([orderId])
  @@map("delivery_tasks")
}

model ProofOfDelivery {
  id              String   @id @default(uuid()) @db.Uuid
  deliveryTaskId  String   @map("delivery_task_id") @db.Uuid
  agentId         String   @map("agent_id") @db.Uuid
  photoUrl        String   @map("photo_url")
  signatureUrl    String?  @map("signature_url")
  recipientName   String   @map("recipient_name")
  geolocationLat  Decimal? @map("geolocation_lat") @db.Decimal(10, 7)
  geolocationLng  Decimal? @map("geolocation_lng") @db.Decimal(10, 7)
  capturedAt      DateTime @default(now()) @map("captured_at")

  deliveryTask DeliveryTask  @relation(fields: [deliveryTaskId], references: [id], onDelete: Cascade)
  agent        DeliveryAgent @relation(fields: [agentId], references: [id])

  @@index([deliveryTaskId])
  @@map("proof_of_delivery")
}

model ZatcaInvoice {
  id                 String                @id @default(uuid()) @db.Uuid
  orderId            String                @map("order_id") @db.Uuid
  invoiceNumber      String                @unique @map("invoice_number")
  invoiceType        ZatcaInvoiceType      @map("invoice_type")
  totalAmountSar     Decimal               @map("total_amount_sar") @db.Decimal(12, 2)
  vatAmountSar       Decimal               @map("vat_amount_sar") @db.Decimal(10, 2)
  xmlDocumentUrl     String                @map("xml_document_url")
  cryptographicHash  String                @map("cryptographic_hash")
  zatcaReference     String?               @map("zatca_reference")
  submissionStatus   ZatcaSubmissionStatus @default(pending) @map("submission_status")
  failureCode        String?               @map("failure_code")
  submittedAt        DateTime?             @map("submitted_at")
  createdAt          DateTime              @default(now()) @map("created_at")

  order    Order                @relation(fields: [orderId], references: [id])
  feeInvoices PlatformFeeInvoice[]

  @@index([submissionStatus])
  @@map("zatca_invoices")
}

model ReturnRequest {
  id                String       @id @default(uuid()) @db.Uuid
  orderId           String       @map("order_id") @db.Uuid
  clientId          String       @map("client_id") @db.Uuid
  reasonCode        String       @map("reason_code")
  reasonDescription String       @map("reason_description")
  photoEvidenceUrl  String?      @map("photo_evidence_url")
  status            ReturnStatus @default(requested)
  mediatedBy        String?      @map("mediated_by") @db.Uuid
  resolutionNotes   String?      @map("resolution_notes")
  refundAmountSar   Decimal?     @map("refund_amount_sar") @db.Decimal(12, 2)
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  order Order @relation(fields: [orderId], references: [id])

  @@index([clientId, status])
  @@map("return_requests")
}

model AuditLog {
  id            String   @id @default(uuid()) @db.Uuid
  actorId       String   @map("actor_id") @db.Uuid
  entityType    String   @map("entity_type")
  entityId      String   @map("entity_id") @db.Uuid
  action        String
  previousState Json?    @map("previous_state")
  newState      Json?    @map("new_state")
  metadata      Json?
  ipAddress     String   @map("ip_address")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}

model Notification {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  notificationType String   @map("notification_type")
  titleAr          String   @map("title_ar")
  titleEn          String   @map("title_en")
  messageAr        String   @map("message_ar")
  messageEn        String   @map("message_en")
  entityType       String?  @map("entity_type")
  entityId         String?  @map("entity_id") @db.Uuid
  isRead           Boolean  @default(false) @map("is_read")
  createdAt        DateTime @default(now()) @map("created_at")

  @@index([userId, isRead, createdAt])
  @@map("notifications")
}
```

`AuditLog` has no `updatedAt` field, by design — an append-only table has nothing to update.

- [ ] **Step 4: Migrate**

```bash
npx prisma migrate dev --name orders_through_notifications
```

Expected: fifteen new tables, no validation errors, no remaining commented-out relations.

- [ ] **Step 5: Verify the full schema and count tables**

Run:
```bash
npx prisma validate
docker exec partek-db psql -U partek -d partek -c "\dt" | wc -l
```
Expected: "The schema is valid." and exactly 43 tables — the 42 models plus `_prisma_migrations`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add order, payment, delivery, compliance, returns, audit, notifications

Completes the schema. delivery_tasks.delivery_hash is nullable and
unique: the hash covers agent_id, which does not exist until an agent is
assigned, so it cannot be generated at task creation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

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

## Task 11: Auth — password hashing and register

**Files:**
- Create: `src/auth/password.service.ts`
- Create: `src/auth/password.service.spec.ts`
- Create: `src/auth/auth.repository.ts`
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.service.spec.ts`
- Create: `src/auth/dto/auth-response.dto.ts`
- Modify: `src/auth/dto/register.dto.ts`

**Interfaces:**
- Consumes: `AppConfig` from Task 9, `PrismaService` from Task 10, the existing `RegisterDto`.
- Produces:
  - `PasswordService.hash(plain: string): Promise<string>` and `.compare(plain: string, hash: string): Promise<boolean>`
  - `AuthRepository.findUserByEmail(email: string)`, `.createUser(data: CreateUserData)`, `.touchLastLogin(userId: string)`
  - `AuthService.register(dto: RegisterDto, ctx: RequestContext): Promise<AuthTokensDto>`
  - `AuthTokensDto { accessToken: string; refreshToken: string; user: AuthUserDto }`
  - `RequestContext { ipAddress: string; userAgent?: string }`

- [ ] **Step 1: Write the failing password service test**

Create `src/auth/password.service.spec.ts`:

```ts
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService(10);

  it('produces a hash that is not the plaintext', async () => {
    const hash = await service.hash('correct-horse');
    expect(hash).not.toBe('correct-horse');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a different hash each call for the same input', async () => {
    const [a, b] = await Promise.all([
      service.hash('correct-horse'),
      service.hash('correct-horse'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('correct-horse');
    await expect(service.compare('correct-horse', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct-horse');
    await expect(service.compare('wrong-horse', hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/auth/password.service.spec.ts`
Expected: FAIL — `Cannot find module './password.service'`.

- [ ] **Step 3: Write `src/auth/password.service.ts`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export const BCRYPT_ROUNDS = 'BCRYPT_ROUNDS';

@Injectable()
export class PasswordService {
  constructor(@Inject(BCRYPT_ROUNDS) private readonly rounds: number) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/auth/password.service.spec.ts`
Expected: 4 PASS.

- [ ] **Step 5: Extend `RegisterDto` with the fields the User model requires**

Replace `src/auth/dto/register.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { Language, UserRole } from '@prisma-client';

export class RegisterDto {
  @ApiProperty({ example: 'buyer@fleet.sa' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'correct-horse-battery', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+9665\d{8}$/, {
    message: 'phone must be a Saudi mobile number in +9665XXXXXXXX format',
  })
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.client })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ enum: Language, default: Language.en })
  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;
}
```

The existing `register.dto.spec.ts` asserts a 6-character minimum. Update its third test to use a 7-character password and expect failure, since the minimum is now 8:

```ts
  it('fails with password shorter than 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'pass123',
      role: 'client',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
```

Also add `role: 'client'` to the two passing cases in that file, or they will now fail on the missing required field.

- [ ] **Step 6: Write `src/auth/dto/auth-response.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Language, UserRole, UserStatus } from '@prisma-client';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiProperty({ enum: Language }) preferredLanguage: Language;
}

export class AuthTokensDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
}
```

`passwordHash` appears in no response DTO anywhere in the codebase. That is deliberate — the same structural approach the spec mandates for vendor anonymity.

- [ ] **Step 7: Write `src/auth/auth.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Language, User, UserRole } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  phone?: string;
  role: UserRole;
  preferredLanguage?: Language;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
```

- [ ] **Step 8: Write the failing register test**

Create `src/auth/auth.service.spec.ts`:

```ts
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole, UserStatus, Language } from '@prisma-client';

const buildUser = (overrides: Partial<any> = {}) => ({
  id: 'user-1',
  email: 'buyer@fleet.sa',
  passwordHash: 'hashed',
  phone: null,
  role: UserRole.client,
  status: UserStatus.active,
  preferredLanguage: Language.en,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService.register', () => {
  let repo: any;
  let passwords: any;
  let tokens: any;
  let service: AuthService;

  beforeEach(() => {
    repo = {
      findUserByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest.fn().mockResolvedValue(buildUser()),
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('hashed'),
      compare: jest.fn(),
    };
    tokens = {
      issue: jest.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };
    service = new AuthService(repo, passwords, tokens);
  });

  const dto = {
    email: 'buyer@fleet.sa',
    password: 'correct-horse-battery',
    role: UserRole.client,
  };
  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  it('hashes the password before persisting', async () => {
    await service.register(dto as any, ctx);
    expect(passwords.hash).toHaveBeenCalledWith('correct-horse-battery');
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed' }),
    );
  });

  it('never persists the plaintext password', async () => {
    await service.register(dto as any, ctx);
    const persisted = repo.createUser.mock.calls[0][0];
    expect(JSON.stringify(persisted)).not.toContain('correct-horse-battery');
  });

  it('returns tokens and a user payload without the password hash', async () => {
    const result = await service.register(dto as any, ctx);
    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'buyer@fleet.sa',
      role: UserRole.client,
      status: UserStatus.active,
      preferredLanguage: Language.en,
    });
    expect(JSON.stringify(result)).not.toContain('hashed');
  });

  it('rejects a duplicate email with 409', async () => {
    repo.findUserByEmail.mockResolvedValue(buildUser());
    await expect(service.register(dto as any, ctx)).rejects.toThrow(
      ConflictException,
    );
    expect(repo.createUser).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: FAIL — `Cannot find module './auth.service'`.

- [ ] **Step 10: Write `src/auth/auth.service.ts` (register only)**

```ts
import { ConflictException, Injectable } from '@nestjs/common';
import { User } from '@prisma-client';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { AuthTokensDto, AuthUserDto } from './dto/auth-response.dto';

export interface RequestContext {
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthTokensDto> {
    const existing = await this.repo.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.repo.createUser({
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      phone: dto.phone,
      role: dto.role,
      preferredLanguage: dto.preferredLanguage,
    });

    const pair = await this.tokens.issue(user, ctx);
    return { ...pair, user: this.toAuthUser(user) };
  }

  protected toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
    };
  }
}
```

`TokenService` is written in Task 13. The test mocks it, so this task's tests pass before it exists — but `tsc` will not, so create a one-line placeholder module now and fill it in at Task 13:

```ts
// src/auth/token.service.ts — implemented in Task 13
import { Injectable } from '@nestjs/common';
@Injectable()
export class TokenService {}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx jest src/auth`
Expected: `password.service.spec.ts` 4 PASS, `auth.service.spec.ts` 4 PASS, `register.dto.spec.ts` 3 PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(auth): add password hashing, auth repository, and register

Response DTOs have no passwordHash field at all rather than stripping it
on the way out -- the same structural approach the spec mandates for
vendor anonymity in bids.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Auth — login and the JWT strategy

**Files:**
- Modify: `src/auth/auth.service.ts`
- Modify: `src/auth/auth.service.spec.ts`
- Create: `src/auth/jwt.strategy.ts`
- Create: `src/auth/jwt.strategy.spec.ts`

**Interfaces:**
- Consumes: `AuthService`, `AuthRepository`, `PasswordService` from Task 11.
- Produces:
  - `AuthService.login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokensDto>`
  - `JwtPayload { sub: string; email: string; role: UserRole }`
  - `AuthenticatedUser { id: string; email: string; role: UserRole; status: UserStatus }` — this is what `@CurrentUser()` returns everywhere in the codebase.

- [ ] **Step 1: Write the failing login tests**

Append to `src/auth/auth.service.spec.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService.login', () => {
  let repo: any;
  let passwords: any;
  let tokens: any;
  let service: AuthService;

  beforeEach(() => {
    repo = {
      findUserByEmail: jest.fn().mockResolvedValue(buildUser()),
      createUser: jest.fn(),
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    passwords = { hash: jest.fn(), compare: jest.fn().mockResolvedValue(true) };
    tokens = {
      issue: jest.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };
    service = new AuthService(repo, passwords, tokens);
  });

  const dto = { email: 'buyer@fleet.sa', password: 'correct-horse-battery' };
  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  it('issues tokens for valid credentials', async () => {
    const result = await service.login(dto as any, ctx);
    expect(result.accessToken).toBe('access');
    expect(repo.touchLastLogin).toHaveBeenCalledWith('user-1');
  });

  it('rejects an unknown email with 401', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    await expect(service.login(dto as any, ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong password with 401', async () => {
    passwords.compare.mockResolvedValue(false);
    await expect(service.login(dto as any, ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('gives the same error for unknown email and wrong password', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    const unknownEmail = await service.login(dto as any, ctx).catch((e) => e.message);

    repo.findUserByEmail.mockResolvedValue(buildUser());
    passwords.compare.mockResolvedValue(false);
    const wrongPassword = await service.login(dto as any, ctx).catch((e) => e.message);

    expect(unknownEmail).toBe(wrongPassword);
  });

  it('rejects a suspended account with 401 and does not issue tokens', async () => {
    repo.findUserByEmail.mockResolvedValue(
      buildUser({ status: UserStatus.suspended }),
    );
    await expect(service.login(dto as any, ctx)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('hashes even when the user is unknown, to level timing', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    await service.login(dto as any, ctx).catch(() => undefined);
    expect(passwords.compare).toHaveBeenCalled();
  });
});
```

The identical-error and timing tests both defend against account enumeration. A login endpoint that answers "no such user" faster than "wrong password" leaks the customer list.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: FAIL — `service.login is not a function`.

- [ ] **Step 3: Add `login` to `AuthService`**

```ts
  private static readonly INVALID_CREDENTIALS = 'Invalid email or password';

  /** A real bcrypt hash of a random string, used to level timing on unknown emails. */
  private static readonly DUMMY_HASH =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEe.CFPqZ8jVJ9c1r1YkYlZ1qJ8k1Yq7yzO';

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokensDto> {
    const user = await this.repo.findUserByEmail(dto.email);

    // Always run a comparison, even with no user, so response time does not
    // distinguish "unknown email" from "wrong password".
    const passwordMatches = await this.passwords.compare(
      dto.password,
      user?.passwordHash ?? AuthService.DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(AuthService.INVALID_CREDENTIALS);
    }
    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException(AuthService.INVALID_CREDENTIALS);
    }

    await this.repo.touchLastLogin(user.id);
    const pair = await this.tokens.issue(user, ctx);
    return { ...pair, user: this.toAuthUser(user) };
  }
```

Add the imports `UnauthorizedException` from `@nestjs/common`, `UserStatus` from `@prisma-client`, and `LoginDto` from `./dto/login.dto`.

A suspended account returns the same message as bad credentials — telling a suspended user their account exists but is blocked confirms the address to anyone probing.

- [ ] **Step 4: Run to verify the login tests pass**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: all 10 PASS (4 register + 6 login).

- [ ] **Step 5: Write the failing strategy test**

Create `src/auth/jwt.strategy.spec.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus, Language } from '@prisma-client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const user = {
    id: 'user-1',
    email: 'buyer@fleet.sa',
    passwordHash: 'hashed',
    phone: null,
    role: UserRole.client,
    status: UserStatus.active,
    preferredLanguage: Language.en,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let repo: any;
  let strategy: JwtStrategy;

  beforeEach(() => {
    repo = { findUserById: jest.fn().mockResolvedValue(user) };
    strategy = new JwtStrategy({ get: () => 'a'.repeat(32) } as any, repo);
  });

  const payload = { sub: 'user-1', email: 'buyer@fleet.sa', role: UserRole.client };

  it('resolves the user from the token subject', async () => {
    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'user-1',
      email: 'buyer@fleet.sa',
      role: UserRole.client,
      status: UserStatus.active,
    });
  });

  it('never exposes the password hash', async () => {
    const result = await strategy.validate(payload);
    expect(JSON.stringify(result)).not.toContain('hashed');
  });

  it('rejects a token whose user no longer exists', async () => {
    repo.findUserById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose user has since been suspended', async () => {
    repo.findUserById.mockResolvedValue({ ...user, status: UserStatus.suspended });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('reads the role from the database, not the token', async () => {
    repo.findUserById.mockResolvedValue({ ...user, role: UserRole.client });
    const result = await strategy.validate({ ...payload, role: UserRole.admin });
    expect(result.role).toBe(UserRole.client);
  });
});
```

That last test is the important one. Trusting the role claim inside the token means a stale token keeps admin rights after a demotion.

- [ ] **Step 6: Run to verify failure**

Run: `npx jest src/auth/jwt.strategy.spec.ts`
Expected: FAIL — `Cannot find module './jwt.strategy'`.

- [ ] **Step 7: Write `src/auth/jwt.strategy.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole, UserStatus } from '@prisma-client';
import { AppConfig } from '@/config/configuration';
import { AuthRepository } from './auth.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repo: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.accessSecret', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.repo.findUserById(payload.sub);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException();
    }
    // Role comes from the database, never from the token claim: a token
    // issued before a demotion must not retain the old role.
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
```

- [ ] **Step 8: Run to verify the strategy tests pass**

Run: `npx jest src/auth`
Expected: 19 PASS across the four auth spec files.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(auth): add login and the JWT strategy

Login runs a bcrypt comparison even for unknown emails and returns one
message for every failure mode, so neither response body nor response
time enumerates accounts. The strategy re-reads role and status from the
database rather than trusting token claims.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Auth — refresh, logout, and the token service

**Files:**
- Rewrite: `src/auth/token.service.ts` (the Task 11 placeholder)
- Create: `src/auth/token.service.spec.ts`
- Create: `src/auth/token.repository.ts`
- Modify: `src/auth/auth.service.ts`
- Create: `src/auth/dto/refresh.dto.ts`
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`

**Interfaces:**
- Consumes: `AuthRepository`, `PasswordService` from Task 11; `JwtStrategy` from Task 12.
- Produces:
  - `TokenService.issue(user, ctx): Promise<TokenPair>`, `.rotate(refreshToken, ctx): Promise<TokenPair & { user: User }>`, `.revoke(refreshToken): Promise<void>`, `.revokeAllForUser(userId): Promise<void>`
  - `TokenRepository.create(...)`, `.findActiveByHash(hash)`, `.revokeById(id)`, `.revokeAllForUser(userId)`
  - `AuthModule` — imported by `AppModule` in Task 18.

- [ ] **Step 1: Write `src/auth/token.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class TokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findActiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Step 2: Write the failing token service test**

Create `src/auth/token.service.spec.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus, Language } from '@prisma-client';
import { TokenService } from './token.service';

const user = {
  id: 'user-1',
  email: 'buyer@fleet.sa',
  passwordHash: 'hashed',
  phone: null,
  role: UserRole.client,
  status: UserStatus.active,
  preferredLanguage: Language.en,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TokenService', () => {
  let jwt: any;
  let repo: any;
  let authRepo: any;
  let service: TokenService;

  beforeEach(() => {
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
    repo = {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      findActiveByHash: jest.fn(),
      revokeById: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    authRepo = { findUserById: jest.fn().mockResolvedValue(user) };
    service = new TokenService(
      jwt,
      repo,
      authRepo,
      { accessSecret: 'a'.repeat(32), accessExpiresIn: '15m',
        refreshSecret: 'b'.repeat(32), refreshExpiresIn: '7d' },
    );
  });

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  it('issues an access token and an opaque refresh token', async () => {
    const pair = await service.issue(user as any, ctx);
    expect(pair.accessToken).toBe('signed-access-token');
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stores the refresh token hashed, never in plaintext', async () => {
    const pair = await service.issue(user as any, ctx);
    const stored = repo.create.mock.calls[0][0];
    expect(stored.tokenHash).not.toBe(pair.refreshToken);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.userId).toBe('user-1');
  });

  it('signs the access token with sub, email, and role', async () => {
    await service.issue(user as any, ctx);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'user-1', email: 'buyer@fleet.sa', role: UserRole.client },
      expect.objectContaining({ expiresIn: '15m' }),
    );
  });

  it('rotates a valid refresh token and revokes the old one', async () => {
    repo.findActiveByHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });
    const result = await service.rotate('old-token', ctx);
    expect(repo.revokeById).toHaveBeenCalledWith('rt-1');
    expect(repo.create).toHaveBeenCalled();
    expect(result.refreshToken).not.toBe('old-token');
  });

  it('rejects an unknown, expired, or already-revoked refresh token', async () => {
    repo.findActiveByHash.mockResolvedValue(null);
    await expect(service.rotate('bad-token', ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects rotation when the user has since been suspended', async () => {
    repo.findActiveByHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });
    authRepo.findUserById.mockResolvedValue({ ...user, status: UserStatus.suspended });
    await expect(service.rotate('old-token', ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokes on logout', async () => {
    repo.findActiveByHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });
    await service.revoke('a-token');
    expect(repo.revokeById).toHaveBeenCalledWith('rt-1');
  });

  it('treats logout with an unknown token as a no-op', async () => {
    repo.findActiveByHash.mockResolvedValue(null);
    await expect(service.revoke('unknown')).resolves.toBeUndefined();
    expect(repo.revokeById).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/auth/token.service.spec.ts`
Expected: FAIL — `TokenService is not a constructor` or missing methods.

- [ ] **Step 4: Replace `src/auth/token.service.ts`**

```ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { User, UserStatus } from '@prisma-client';
import { AuthRepository } from './auth.repository';
import { TokenRepository } from './token.repository';
import { JwtPayload } from './jwt.strategy';

export const JWT_CONFIG = 'JWT_CONFIG';

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenContext {
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly tokens: TokenRepository,
    private readonly users: AuthRepository,
    @Inject(JWT_CONFIG) private readonly config: JwtConfig,
  ) {}

  async issue(user: User, ctx: TokenContext): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      expiresIn: this.config.accessExpiresIn,
    });

    // The refresh token is opaque, not a JWT. It carries no claims, so it
    // cannot be read or replayed for information, and revocation is a
    // single indexed row lookup.
    const refreshToken = randomBytes(32).toString('hex');

    await this.tokens.create({
      userId: user.id,
      tokenHash: this.hash(refreshToken),
      expiresAt: this.refreshExpiry(),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return { accessToken, refreshToken };
  }

  async rotate(
    refreshToken: string,
    ctx: TokenContext,
  ): Promise<TokenPair & { user: User }> {
    const record = await this.tokens.findActiveByHash(this.hash(refreshToken));
    if (!record) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findUserById(record.userId);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Single use: the presented token is revoked whether or not issuing the
    // replacement succeeds.
    await this.tokens.revokeById(record.id);
    const pair = await this.issue(user, ctx);
    return { ...pair, user };
  }

  async revoke(refreshToken: string): Promise<void> {
    const record = await this.tokens.findActiveByHash(this.hash(refreshToken));
    if (!record) return;
    await this.tokens.revokeById(record.id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry(): Date {
    const match = /^(\d+)([smhd])$/.exec(this.config.refreshExpiresIn);
    if (!match) {
      throw new Error(
        `JWT_REFRESH_EXPIRES_IN must look like "7d" or "30m" (got "${this.config.refreshExpiresIn}")`,
      );
    }
    const amount = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      match[2] as 's' | 'm' | 'h' | 'd'
    ];
    return new Date(Date.now() + amount * unitMs);
  }
}
```

Refresh tokens are stored as SHA-256 digests, not bcrypt: they are already 256 bits of entropy, so there is nothing to brute-force, and lookup must be an indexed equality match rather than a scan-and-compare.

- [ ] **Step 5: Run to verify the token tests pass**

Run: `npx jest src/auth/token.service.spec.ts`
Expected: 8 PASS.

- [ ] **Step 6: Add `refresh` and `logout` to `AuthService`**

```ts
  async refresh(refreshToken: string, ctx: RequestContext): Promise<AuthTokensDto> {
    const { user, ...pair } = await this.tokens.rotate(refreshToken, ctx);
    return { ...pair, user: this.toAuthUser(user) };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }
```

- [ ] **Step 7: Write `src/auth/dto/refresh.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The opaque refresh token issued at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

- [ ] **Step 8: Write `src/auth/auth.controller.ts`**

```ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService, RequestContext } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthTokensDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account and receive a token pair' })
  @ApiResponse({ status: 201, type: AuthTokensDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthTokensDto> {
    return this.auth.register(dto, this.context(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a token pair' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthTokensDto> {
    return this.auth.login(dto, this.context(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new pair' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthTokensDto> {
    return this.auth.refresh(dto.refreshToken, this.context(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiResponse({ status: 204, description: 'Token revoked, or was already invalid' })
  logout(@Body() dto: RefreshDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  private context(req: Request): RequestContext {
    return {
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? undefined,
    };
  }
}
```

`logout` is `@Public()` and returns 204 for an unknown token. Requiring a valid access token to log out means an expired session can never be cleaned up, and a distinct 404 for an unknown token would let anyone test whether a stolen token is still live.

- [ ] **Step 9: Write `src/auth/auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfig } from '@/config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { TokenRepository } from './token.repository';
import { TokenService, JWT_CONFIG } from './token.service';
import { PasswordService, BCRYPT_ROUNDS } from './password.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    TokenRepository,
    TokenService,
    PasswordService,
    JwtStrategy,
    {
      provide: BCRYPT_ROUNDS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        config.get('bcryptRounds', { infer: true }),
    },
    {
      provide: JWT_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        config.get('jwt', { infer: true }),
    },
  ],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
```

- [ ] **Step 10: Verify everything compiles and passes**

Run: `npx tsc --noEmit && npx jest src/auth`
Expected: no TypeScript errors except the still-absent `src/main.ts`; 27 tests PASS.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(auth): add refresh, logout, token service, controller, module

Refresh tokens are opaque 256-bit values stored as SHA-256 digests and
rotated single-use. Logout is public and idempotent: requiring a live
access token would strand expired sessions, and a distinct error for an
unknown token would let an attacker probe whether a stolen one is still
valid.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: RolesGuard, @Roles(), and global guard registration

**Files:**
- Create: `src/common/decorators/roles.decorator.ts`
- Create: `src/common/guards/roles.guard.ts`
- Create: `src/common/guards/roles.guard.spec.ts`
- Modify: `src/common/decorators/current-user.decorator.ts`
- Modify: `src/common/guards/jwt-auth.guard.ts`

**Interfaces:**
- Consumes: `AuthenticatedUser` from Task 12; the existing `IS_PUBLIC_KEY` and `Public()`.
- Produces: `@Roles(...roles: UserRole[])`, `RolesGuard`, and a typed `@CurrentUser()` returning `AuthenticatedUser`. Every controller in Phase 3 uses these.

- [ ] **Step 1: Write `src/common/decorators/roles.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma-client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: Type `@CurrentUser()`**

Replace `src/common/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '@/auth/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
```

`@CurrentUser('id')` is now available alongside `@CurrentUser()`, which keeps controllers that only need the ID from destructuring at every call site.

- [ ] **Step 3: Write the failing guard test**

Create `src/common/guards/roles.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma-client';
import { RolesGuard } from './roles.guard';

const contextFor = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const stubMetadata = (isPublic: boolean, roles?: UserRole[]) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: any) =>
        key === 'isPublic' ? isPublic : roles,
      );
  };

  it('allows a route with no @Roles metadata', () => {
    stubMetadata(false, undefined);
    expect(guard.canActivate(contextFor({ role: UserRole.client }))).toBe(true);
  });

  it('allows a public route with no authenticated user', () => {
    stubMetadata(true, [UserRole.admin]);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    stubMetadata(false, [UserRole.admin, UserRole.vendor]);
    expect(guard.canActivate(contextFor({ role: UserRole.vendor }))).toBe(true);
  });

  it('rejects a user whose role is not listed', () => {
    stubMetadata(false, [UserRole.admin]);
    expect(() => guard.canActivate(contextFor({ role: UserRole.client }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a protected role-gated route with no user', () => {
    stubMetadata(false, [UserRole.admin]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects rather than allows when @Roles is present but empty', () => {
    stubMetadata(false, []);
    expect(() => guard.canActivate(contextFor({ role: UserRole.admin }))).toThrow(
      ForbiddenException,
    );
  });
});
```

That final case is the one worth writing deliberately: `@Roles()` with no arguments is almost certainly a mistake, and a guard that treats an empty list as "no restriction" turns a typo into an open endpoint.

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/common/guards/roles.guard.spec.ts`
Expected: FAIL — `Cannot find module './roles.guard'`.

- [ ] **Step 5: Write `src/common/guards/roles.guard.ts`**

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma-client';
import { AuthenticatedUser } from '@/auth/jwt.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) return true;

    const user = context.switchToHttp().getRequest().user as
      | AuthenticatedUser
      | undefined;

    // An empty @Roles() list denies rather than permits: it is far more
    // likely a mistake than an intentional "anyone authenticated".
    if (!user || required.length === 0 || !required.includes(user.role)) {
      throw new ForbiddenException(
        'Your role does not have access to this resource',
      );
    }
    return true;
  }
}
```

- [ ] **Step 6: Run to verify the guard tests pass**

Run: `npx jest src/common/guards`
Expected: 6 PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(common): add RolesGuard, @Roles(), and typed @CurrentUser()

An empty @Roles() list denies access rather than permitting it -- an
argument-less decorator is far more likely a typo than an intentional
'any authenticated user', and the failure mode of guessing wrong is an
open endpoint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: Users module

**Files:**
- Create: `src/users/users.repository.ts`
- Create: `src/users/users.service.ts`
- Create: `src/users/users.service.spec.ts`
- Create: `src/users/users.controller.ts`
- Create: `src/users/users.module.ts`
- Create: `src/users/dto/{create-user,update-user,user-response,list-users-query}.dto.ts`

**Interfaces:**
- Consumes: `PasswordService` from Task 11, `RolesGuard`/`@Roles` from Task 14.
- Produces:
  - `UsersRepository.findMany(filter)`, `.count(filter)`, `.findById(id)`, `.findByEmail(email)`, `.create(data)`, `.update(id, data)`, `.setStatus(id, status)`
  - `UsersService.list(query): Promise<Paginated<UserResponseDto>>`, `.findOne(id)`, `.create(dto)`, `.update(id, dto)`, `.changeRole(id, role, actor)`, `.setStatus(id, status)`
  - `Paginated<T> { data: T[]; total: number; page: number; pageSize: number }` — the pagination envelope every list endpoint in Phase 3 reuses.

- [ ] **Step 1: Write the DTOs**

`src/users/dto/user-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language, User, UserRole, UserStatus } from '@prisma-client';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiProperty({ enum: Language }) preferredLanguage: Language;
  @ApiPropertyOptional({ nullable: true }) lastLoginAt: Date | null;
  @ApiProperty() createdAt: Date;

  /**
   * The only permitted way to turn a User row into a response. There is no
   * passwordHash field on this class, so it cannot leak through spread or
   * serialization.
   */
  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
```

`src/users/dto/create-user.dto.ts`:

```ts
import { RegisterDto } from '@/auth/dto/register.dto';

export class CreateUserDto extends RegisterDto {}
```

`src/users/dto/update-user.dto.ts`:

```ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { UserRole, UserStatus } from '@prisma-client';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'role'] as const),
) {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
```

Password is omitted deliberately — changing a password is a separate flow with its own current-password check, not a field on a general update.

`src/users/dto/list-users-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole, UserStatus } from '@prisma-client';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive email substring' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
```

`pageSize` is capped at 100 so no caller can request the entire users table in one query.

- [ ] **Step 2: Write `src/users/users.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, User, UserStatus } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface UserFilter {
  role?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(filter: UserFilter): Prisma.UserWhereInput {
    return {
      role: filter.role as Prisma.UserWhereInput['role'],
      status: filter.status as Prisma.UserWhereInput['status'],
      email: filter.search
        ? { contains: filter.search, mode: 'insensitive' }
        : undefined,
    };
  }

  findMany(filter: UserFilter, skip: number, take: number): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.where(filter),
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(filter: UserFilter): Promise<number> {
    return this.prisma.user.count({ where: this.where(filter) });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  setStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }
}
```

- [ ] **Step 3: Write the failing service test**

Create `src/users/users.service.spec.ts`:

```ts
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Language, UserRole, UserStatus } from '@prisma-client';
import { UsersService } from './users.service';

const buildUser = (overrides: Partial<any> = {}) => ({
  id: 'user-1',
  email: 'buyer@fleet.sa',
  passwordHash: 'hashed',
  phone: null,
  role: UserRole.client,
  status: UserStatus.active,
  preferredLanguage: Language.en,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('UsersService', () => {
  let repo: any;
  let passwords: any;
  let audit: any;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findMany: jest.fn().mockResolvedValue([buildUser()]),
      count: jest.fn().mockResolvedValue(1),
      findById: jest.fn().mockResolvedValue(buildUser()),
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(buildUser()),
      update: jest.fn().mockResolvedValue(buildUser()),
      setStatus: jest.fn().mockResolvedValue(buildUser({ status: UserStatus.suspended })),
    };
    passwords = { hash: jest.fn().mockResolvedValue('hashed') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(repo, passwords, audit);
  });

  const actor = { id: 'admin-1', ipAddress: '127.0.0.1' };

  it('returns a paginated envelope', async () => {
    const result = await service.list({ page: 2, pageSize: 10 } as any);
    expect(result).toEqual({
      data: [expect.objectContaining({ id: 'user-1' })],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(repo.findMany).toHaveBeenCalledWith(expect.anything(), 10, 10);
  });

  it('never includes passwordHash in any listed user', async () => {
    const result = await service.list({ page: 1, pageSize: 25 } as any);
    expect(JSON.stringify(result)).not.toContain('hashed');
  });

  it('throws 404 for an unknown id', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects creating a user with a taken email', async () => {
    repo.findByEmail.mockResolvedValue(buildUser());
    await expect(
      service.create({ email: 'buyer@fleet.sa', password: 'x'.repeat(8), role: UserRole.client } as any, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('hashes the password on create', async () => {
    await service.create(
      { email: 'new@fleet.sa', password: 'correct-horse', role: UserRole.client } as any,
      actor,
    );
    expect(passwords.hash).toHaveBeenCalledWith('correct-horse');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed' }),
    );
  });

  it('writes an audit entry on role change', async () => {
    repo.update.mockResolvedValue(buildUser({ role: UserRole.admin }));
    await service.changeRole('user-1', UserRole.admin, actor);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        entityType: 'User',
        entityId: 'user-1',
        action: 'role_changed',
        previousState: { role: UserRole.client },
        newState: { role: UserRole.admin },
      }),
    );
  });

  it('refuses to change a role to the one already held', async () => {
    await expect(
      service.changeRole('user-1', UserRole.client, actor),
    ).rejects.toThrow(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('refuses to let an admin change their own role', async () => {
    repo.findById.mockResolvedValue(buildUser({ id: 'admin-1', role: UserRole.admin }));
    await expect(
      service.changeRole('admin-1', UserRole.client, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes an audit entry on status change', async () => {
    await service.setStatus('user-1', UserStatus.suspended, actor);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'status_changed' }),
    );
  });
});
```

Self-demotion is blocked because an admin who removes their own role in a single-admin deployment locks everyone out permanently.

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/users`
Expected: FAIL — `Cannot find module './users.service'`.

- [ ] **Step 5: Write `src/users/users.service.ts`**

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma-client';
import { PasswordService } from '@/auth/password.service';
import { AuditService } from '@/audit/audit.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActorContext {
  id: string;
  ipAddress: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<UserResponseDto>> {
    const filter = { role: query.role, status: query.status, search: query.search };
    const skip = (query.page - 1) * query.pageSize;

    const [users, total] = await Promise.all([
      this.repo.findMany(filter, skip, query.pageSize),
      this.repo.count(filter),
    ]);

    return {
      data: users.map(UserResponseDto.from),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.getOrThrow(id));
  }

  async create(dto: CreateUserDto, actor: ActorContext): Promise<UserResponseDto> {
    if (await this.repo.findByEmail(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.repo.create({
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      phone: dto.phone,
      role: dto.role,
      preferredLanguage: dto.preferredLanguage,
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: user.id,
      action: 'created',
      newState: { email: user.email, role: user.role },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const existing = await this.getOrThrow(id);

    if (dto.email && dto.email !== existing.email) {
      const clash = await this.repo.findByEmail(dto.email);
      if (clash) {
        throw new ConflictException('An account with this email already exists');
      }
    }

    const updated = await this.repo.update(id, {
      email: dto.email,
      phone: dto.phone,
      preferredLanguage: dto.preferredLanguage,
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: id,
      action: 'updated',
      previousState: { email: existing.email, phone: existing.phone },
      newState: { email: updated.email, phone: updated.phone },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(updated);
  }

  async changeRole(
    id: string,
    role: UserRole,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const existing = await this.getOrThrow(id);

    if (existing.id === actor.id) {
      throw new BadRequestException(
        'You cannot change your own role. Ask another admin.',
      );
    }
    if (existing.role === role) {
      throw new BadRequestException(`User already has the role "${role}"`);
    }

    const updated = await this.repo.update(id, { role });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: id,
      action: 'role_changed',
      previousState: { role: existing.role },
      newState: { role },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(updated);
  }

  async setStatus(
    id: string,
    status: UserStatus,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const existing = await this.getOrThrow(id);

    if (existing.id === actor.id) {
      throw new BadRequestException('You cannot change your own status');
    }

    const updated = await this.repo.setStatus(id, status);

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: id,
      action: 'status_changed',
      previousState: { status: existing.status },
      newState: { status },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(updated);
  }

  private async getOrThrow(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
```

- [ ] **Step 6: Write `src/users/users.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole, UserStatus } from '@prisma-client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/auth/jwt.strategy';
import { UsersService, ActorContext } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user' })
  me(@CurrentUser('id') id: string): Promise<UserResponseDto> {
    return this.users.findOne(id);
  }

  @Get()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'List users (admin only)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Fetch one user (admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create a user (admin only)' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.users.create(dto, this.actor(user, req));
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update a user, including role and status' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const actor = this.actor(user, req);
    if (dto.role) await this.users.changeRole(id, dto.role, actor);
    if (dto.status) await this.users.setStatus(id, dto.status, actor);
    return this.users.update(id, dto, actor);
  }

  private actor(user: AuthenticatedUser, req: Request): ActorContext {
    return { id: user.id, ipAddress: req.ip ?? 'unknown' };
  }
}
```

Role and status changes route through their dedicated service methods rather than the generic update, so each produces its own distinct audit action rather than an opaque `updated`.

- [ ] **Step 7: Write `src/users/users.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
```

`AuthModule` must export `PasswordService` for this to resolve — add it to that module's `exports` array now.

- [ ] **Step 8: Run the tests**

Run: `npx jest src/users`
Expected: 9 PASS. `AuditService` is mocked, so it need not exist yet — but `tsc` requires it, so Task 16 follows immediately.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(users): add users module with role and status management

Role and status changes are separate service methods with their own
audit actions rather than fields on a generic update. Blocks self
role/status changes: an admin who demotes themselves in a single-admin
deployment locks everyone out permanently.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 16: Audit module

**Files:**
- Create: `src/audit/audit.repository.ts`
- Create: `src/audit/audit.service.ts`
- Create: `src/audit/audit.service.spec.ts`
- Create: `src/audit/audit.controller.ts`
- Create: `src/audit/audit.module.ts`
- Create: `src/audit/dto/{audit-log-response,list-audit-query}.dto.ts`

**Interfaces:**
- Consumes: `PrismaService.audited` from Task 10.
- Produces: `AuditService.log(entry: AuditEntry): Promise<void>` and `.list(query)`. `AuditEntry { actorId, entityType, entityId, action, previousState?, newState?, metadata?, ipAddress }`. Every service in Phase 3 calls `log()` on significant state changes.

- [ ] **Step 1: Write `src/audit/audit.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
}

/**
 * Append-only by construction. This class deliberately exposes no update,
 * delete, or upsert method, and it goes through `prisma.audited` so that
 * any attempt added later throws at the ORM boundary. The database trigger
 * from the raw_constraints migration is the backstop.
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(filter: AuditFilter): Prisma.AuditLogWhereInput {
    return {
      entityType: filter.entityType,
      entityId: filter.entityId,
      actorId: filter.actorId,
      action: filter.action,
    };
  }

  create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return this.prisma.audited.auditLog.create({ data });
  }

  findMany(filter: AuditFilter, skip: number, take: number): Promise<AuditLog[]> {
    return this.prisma.audited.auditLog.findMany({
      where: this.where(filter),
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(filter: AuditFilter): Promise<number> {
    return this.prisma.audited.auditLog.count({ where: this.where(filter) });
  }
}
```

- [ ] **Step 2: Write the DTOs**

`src/audit/dto/audit-log-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditLog } from '@prisma-client';

export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() actorId: string;
  @ApiProperty() entityType: string;
  @ApiProperty() entityId: string;
  @ApiProperty() action: string;
  @ApiPropertyOptional({ nullable: true }) previousState: unknown;
  @ApiPropertyOptional({ nullable: true }) newState: unknown;
  @ApiPropertyOptional({ nullable: true }) metadata: unknown;
  @ApiProperty() ipAddress: string;
  @ApiProperty() createdAt: Date;

  static from(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      actorId: log.actorId,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      previousState: log.previousState,
      newState: log.newState,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    };
  }
}
```

`src/audit/dto/list-audit-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAuditQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize = 50;
}
```

- [ ] **Step 3: Write the failing service test**

Create `src/audit/audit.service.spec.ts`:

```ts
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let repo: any;
  let service: AuditService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    service = new AuditService(repo);
  });

  const entry = {
    actorId: 'admin-1',
    entityType: 'User',
    entityId: 'user-1',
    action: 'role_changed',
    previousState: { role: 'client' },
    newState: { role: 'admin' },
    ipAddress: '127.0.0.1',
  };

  it('persists an entry', async () => {
    await service.log(entry);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining(entry));
  });

  it('exposes no update or delete method', () => {
    expect((service as any).update).toBeUndefined();
    expect((service as any).delete).toBeUndefined();
    expect((service as any).remove).toBeUndefined();
  });

  it('never lets a logging failure break the caller', async () => {
    repo.create.mockRejectedValue(new Error('database is down'));
    await expect(service.log(entry)).resolves.toBeUndefined();
  });

  it('returns a paginated envelope', async () => {
    repo.findMany.mockResolvedValue([
      {
        id: 'log-1',
        actorId: 'admin-1',
        entityType: 'User',
        entityId: 'user-1',
        action: 'role_changed',
        previousState: null,
        newState: null,
        metadata: null,
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      },
    ]);
    repo.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, pageSize: 50 } as any);
    expect(result.total).toBe(1);
    expect(result.data[0].action).toBe('role_changed');
  });
});
```

The swallowed-failure test encodes a real decision: an audit write that fails must not roll back the business operation it describes. A failed role change because the log table was briefly unavailable is worse than a missing log line — the failure is logged to the application logger instead.

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/audit`
Expected: FAIL — `Cannot find module './audit.service'`.

- [ ] **Step 5: Write `src/audit/audit.service.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma-client';
import { AuditRepository } from './audit.repository';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';
import { Paginated } from '@/users/users.service';

export interface AuditEntry {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress: string;
}

/**
 * Append-only. There is no update, delete, or remove method on this class,
 * and none may be added -- see the raw_constraints migration and the
 * auditAppendOnly Prisma extension.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.create(entry);
    } catch (error) {
      // An audit write must never roll back the operation it describes.
      // Losing the business action is worse than losing the log line.
      this.logger.error(
        `Failed to write audit entry ${entry.action} on ${entry.entityType}:${entry.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(query: ListAuditQueryDto): Promise<Paginated<AuditLogResponseDto>> {
    const filter = {
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      action: query.action,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [logs, total] = await Promise.all([
      this.repo.findMany(filter, skip, query.pageSize),
      this.repo.count(filter),
    ]);

    return {
      data: logs.map(AuditLogResponseDto.from),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
```

- [ ] **Step 6: Write `src/audit/audit.controller.ts`**

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma-client';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

/**
 * Read-only by design. No POST, PATCH, PUT, or DELETE route exists here,
 * and none may be added: audit entries are written by services, never by
 * API callers.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Roles(UserRole.admin)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit entries (admin only, read-only)' })
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }
}
```

- [ ] **Step 7: Write `src/audit/audit.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 8: Run the tests**

Run: `npx jest src/audit src/users`
Expected: 13 PASS (4 audit + 9 users).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(audit): add append-only audit module

No update/delete method on the service, no mutating route on the
controller, and all writes go through prisma.audited. A failed audit
write logs and continues rather than rolling back the business operation
it describes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 17: Notifications module

**Files:**
- Create: `src/notifications/notifications.repository.ts`
- Create: `src/notifications/notifications.service.ts`
- Create: `src/notifications/notifications.service.spec.ts`
- Create: `src/notifications/notifications.controller.ts`
- Create: `src/notifications/notifications.module.ts`
- Create: `src/notifications/dto/{create-notification,notification-response,list-notifications-query}.dto.ts`

**Interfaces:**
- Consumes: `PrismaService`, `Paginated<T>` from Task 15.
- Produces: `NotificationsService.create(dto)`, `.listForUser(userId, query)`, `.markRead(id, userId)`, `.markAllRead(userId)`, `.unreadCount(userId)`. Phase 3 services call `create()` on vendor approval, bid award, order status change, and delivery events.

- [ ] **Step 1: Write the DTOs**

`src/notifications/dto/create-notification.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty({ example: 'vendor_approved' }) @IsString() notificationType: string;
  @ApiProperty() @IsString() titleAr: string;
  @ApiProperty() @IsString() titleEn: string;
  @ApiProperty() @IsString() messageAr: string;
  @ApiProperty() @IsString() messageEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
}
```

`src/notifications/dto/notification-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification } from '@prisma-client';

export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() notificationType: string;
  @ApiProperty() titleAr: string;
  @ApiProperty() titleEn: string;
  @ApiProperty() messageAr: string;
  @ApiProperty() messageEn: string;
  @ApiPropertyOptional({ nullable: true }) entityType: string | null;
  @ApiPropertyOptional({ nullable: true }) entityId: string | null;
  @ApiProperty() isRead: boolean;
  @ApiProperty() createdAt: Date;

  static from(n: Notification): NotificationResponseDto {
    return {
      id: n.id,
      notificationType: n.notificationType,
      titleAr: n.titleAr,
      titleEn: n.titleEn,
      messageAr: n.messageAr,
      messageEn: n.messageEn,
      entityType: n.entityType,
      entityId: n.entityId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }
}
```

Both language variants are always returned. The client picks based on the active locale, so a language switch never requires a refetch.

`src/notifications/dto/list-notifications-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter to unread only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 25;
}
```

- [ ] **Step 2: Write `src/notifications/notifications.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  findManyForUser(
    userId: string,
    unreadOnly: boolean,
    skip: number,
    take: number,
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countForUser(userId: string, unreadOnly: boolean): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: unreadOnly ? false : undefined },
    });
  }

  /** Scoped by userId so one user cannot mark another's notification read. */
  markRead(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true },
    });
  }

  markAllRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
```

`markRead` uses `updateMany` with both `id` and `userId` in the filter rather than `update` by primary key. A plain `update({ where: { id } })` would let any authenticated user mark any other user's notification read by guessing an ID.

- [ ] **Step 3: Write the failing service test**

Create `src/notifications/notifications.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const buildNotification = (overrides: Partial<any> = {}) => ({
  id: 'n-1',
  userId: 'user-1',
  notificationType: 'vendor_approved',
  titleAr: 'تمت الموافقة',
  titleEn: 'Approved',
  messageAr: 'تمت الموافقة على حسابك',
  messageEn: 'Your account was approved',
  entityType: 'Vendor',
  entityId: 'vendor-1',
  isRead: false,
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

describe('NotificationsService', () => {
  let repo: any;
  let service: NotificationsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(buildNotification()),
      findManyForUser: jest.fn().mockResolvedValue([buildNotification()]),
      countForUser: jest.fn().mockResolvedValue(1),
      markRead: jest.fn().mockResolvedValue({ count: 1 }),
      markAllRead: jest.fn().mockResolvedValue({ count: 3 }),
    };
    service = new NotificationsService(repo);
  });

  it('creates a notification with both language variants', async () => {
    const result = await service.create(buildNotification() as any);
    expect(result.titleAr).toBe('تمت الموافقة');
    expect(result.titleEn).toBe('Approved');
  });

  it('lists only the requesting user notifications', async () => {
    await service.listForUser('user-1', { page: 1, pageSize: 25 } as any);
    expect(repo.findManyForUser).toHaveBeenCalledWith('user-1', false, 0, 25);
  });

  it('filters to unread when asked', async () => {
    await service.listForUser('user-1', {
      unreadOnly: true, page: 1, pageSize: 25,
    } as any);
    expect(repo.findManyForUser).toHaveBeenCalledWith('user-1', true, 0, 25);
  });

  it('marks one notification read, scoped to its owner', async () => {
    await service.markRead('n-1', 'user-1');
    expect(repo.markRead).toHaveBeenCalledWith('n-1', 'user-1');
  });

  it('throws 404 when the notification is not the caller own', async () => {
    repo.markRead.mockResolvedValue({ count: 0 });
    await expect(service.markRead('n-1', 'other-user')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reports how many were marked read in bulk', async () => {
    await expect(service.markAllRead('user-1')).resolves.toEqual({ marked: 3 });
  });

  it('returns the unread count', async () => {
    await expect(service.unreadCount('user-1')).resolves.toBe(1);
    expect(repo.countForUser).toHaveBeenCalledWith('user-1', true);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/notifications`
Expected: FAIL — `Cannot find module './notifications.service'`.

- [ ] **Step 5: Write `src/notifications/notifications.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { Paginated } from '@/users/users.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    return NotificationResponseDto.from(await this.repo.create(dto));
  }

  async listForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<NotificationResponseDto>> {
    const unreadOnly = query.unreadOnly ?? false;
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.repo.findManyForUser(userId, unreadOnly, skip, query.pageSize),
      this.repo.countForUser(userId, unreadOnly),
    ]);

    return {
      data: items.map(NotificationResponseDto.from),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async markRead(id: string, userId: string): Promise<void> {
    const { count } = await this.repo.markRead(id, userId);
    if (count === 0) {
      // Covers "does not exist", "belongs to someone else", and "already
      // read" with one response, so IDs cannot be probed for existence.
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<{ marked: number }> {
    const { count } = await this.repo.markAllRead(userId);
    return { marked: count };
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.countForUser(userId, true);
  }
}
```

- [ ] **Step 6: Write `src/notifications/notifications.controller.ts`**

```ts
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user notifications' })
  list(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.listForUser(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  async unreadCount(@CurrentUser('id') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification read' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.notifications.markRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every notification read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
```

There is no route to list another user's notifications, and no `userId` parameter anywhere — the owner always comes from the token.

- [ ] **Step 7: Write `src/notifications/notifications.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 8: Run the tests**

Run: `npx jest src/notifications`
Expected: 7 PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(notifications): add bilingual per-user notifications module

Ownership always comes from the token -- no endpoint accepts a userId,
and markRead scopes by (id, userId) via updateMany so a guessed ID
cannot touch another user's row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 18: Exception filter, AppModule, bootstrap, Swagger

**Files:**
- Create: `src/common/filters/all-exceptions.filter.ts`
- Create: `src/common/filters/all-exceptions.filter.spec.ts`
- Create: `src/common/interceptors/request-context.interceptor.ts`
- Create: `src/app.module.ts`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: every module from Tasks 9–17.
- Produces: a booting application, Swagger at `/api`, and the `ErrorResponse { statusCode, error, message, messageAr, constraint?, path, timestamp }` shape every endpoint returns on failure.

- [ ] **Step 1: Write the failing filter test**

Create `src/common/filters/all-exceptions.filter.spec.ts`:

```ts
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AuditAppendOnlyError } from '@/database/extensions/audit-append-only.extension';

const buildHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/test', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('passes an HttpException status through', () => {
    const { host, status, json } = buildHost();
    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Nope' }),
    );
  });

  it('maps Prisma P2002 to 409', () => {
    const { host, status } = buildHost();
    filter.catch({ name: 'PrismaClientKnownRequestError', code: 'P2002',
      meta: { target: ['email'] } }, host);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('maps Prisma P2025 to 404', () => {
    const { host, status } = buildHost();
    filter.catch({ name: 'PrismaClientKnownRequestError', code: 'P2025' }, host);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps Prisma P2003 to 400', () => {
    const { host, status } = buildHost();
    filter.catch({ name: 'PrismaClientKnownRequestError', code: 'P2003' }, host);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps a CHECK constraint violation to 422 with the constraint name', () => {
    const { host, status, json } = buildHost();
    filter.catch(
      { name: 'PrismaClientUnknownRequestError',
        message: 'violates check constraint "products_at_least_one_price"' },
      host,
    );
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ constraint: 'products_at_least_one_price' }),
    );
  });

  it('maps AuditAppendOnlyError to 403', () => {
    const { host, status } = buildHost();
    filter.catch(new AuditAppendOnlyError('update'), host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('returns 500 without leaking internals for an unknown error', () => {
    const { host, status, json } = buildHost();
    filter.catch(new Error('connection string is postgres://user:hunter2@db'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('always includes an Arabic message', () => {
    const { host, json } = buildHost();
    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);
    expect(json.mock.calls[0][0].messageAr).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/common/filters`
Expected: FAIL — `Cannot find module './all-exceptions.filter'`.

- [ ] **Step 3: Write `src/common/filters/all-exceptions.filter.ts`**

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuditAppendOnlyError } from '@/database/extensions/audit-append-only.extension';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  messageAr: string;
  constraint?: string;
  path: string;
  timestamp: string;
}

const AR: Record<number, string> = {
  400: 'طلب غير صالح',
  401: 'غير مصرح',
  403: 'ممنوع',
  404: 'غير موجود',
  409: 'تعارض في البيانات',
  422: 'البيانات لا تستوفي الشروط المطلوبة',
  500: 'خطأ في الخادم',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    const body = this.toBody(exception, request.url);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ErrorBody {
    const base = { path, timestamp: new Date().toISOString() };
    const withAr = (partial: Omit<ErrorBody, 'messageAr' | 'path' | 'timestamp'>) => ({
      ...partial,
      messageAr: AR[partial.statusCode] ?? AR[500],
      ...base,
    });

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return withAr({
        statusCode: status,
        error: exception.name,
        message: Array.isArray(message) ? message.join('; ') : message,
      });
    }

    if (exception instanceof AuditAppendOnlyError) {
      return withAr({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'AuditAppendOnly',
        message: exception.message,
      });
    }

    const err = exception as { name?: string; code?: string; message?: string; meta?: { target?: string[] } };

    if (err?.name === 'PrismaClientKnownRequestError') {
      switch (err.code) {
        case 'P2002': {
          const fields = err.meta?.target?.join(', ') ?? 'field';
          return withAr({
            statusCode: HttpStatus.CONFLICT,
            error: 'UniqueConstraintViolation',
            message: `A record with this ${fields} already exists`,
          });
        }
        case 'P2025':
          return withAr({
            statusCode: HttpStatus.NOT_FOUND,
            error: 'RecordNotFound',
            message: 'The requested record does not exist',
          });
        case 'P2003':
          return withAr({
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'ForeignKeyViolation',
            message: 'A referenced record does not exist',
          });
      }
    }

    // Raw CHECK constraints and triggers from the raw_constraints migration
    // surface here rather than as typed Prisma errors.
    const constraint = /(?:check constraint|CONSTRAINT) "([a-z0-9_]+)"/i.exec(
      err?.message ?? '',
    )?.[1];
    if (constraint) {
      return { ...withAr({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'ConstraintViolation',
        message: `The request violates the "${constraint}" rule`,
      }), constraint };
    }

    if (/append-only/i.test(err?.message ?? '')) {
      return withAr({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'AuditAppendOnly',
        message: 'Audit entries are immutable',
      });
    }

    // Never surface an unrecognised error's message: it may contain a
    // connection string, a query, or user data.
    return withAr({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Internal server error',
    });
  }
}
```

- [ ] **Step 4: Run to verify the filter tests pass**

Run: `npx jest src/common/filters`
Expected: 8 PASS.

- [ ] **Step 4b: Write `src/common/interceptors/request-context.interceptor.ts`**

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';

/**
 * Stamps every request with a correlation id, echoes it back as
 * x-request-id, and logs completion with duration. Phase 3 services read
 * `request.requestId` into the audit entry `metadata` so a log line and an
 * audit row can be tied to the same request.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const requestId = request.get('x-request-id') ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(
            `${request.method} ${request.url} ${response.statusCode} ` +
              `${Date.now() - startedAt}ms [${requestId}]`,
          ),
        error: () =>
          this.logger.warn(
            `${request.method} ${request.url} failed after ` +
              `${Date.now() - startedAt}ms [${requestId}]`,
          ),
      }),
    );
  }
}
```

An inbound `x-request-id` is honoured rather than overwritten, so a correlation id set by a gateway or by `partek-fe` survives into the API logs instead of being replaced at the boundary.

- [ ] **Step 5: Write `src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QueuesModule } from './queues/queues.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], cache: true }),
    PrismaModule,
    StorageModule,
    QueuesModule,
    AuthModule,
    UsersModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard populates request.user, which RolesGuard reads.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
```

Add `APP_INTERCEPTOR` to the `@nestjs/core` import alongside `APP_FILTER` and `APP_GUARD`.

`QueuesModule` and `StorageModule` arrive in Task 19 — comment those two imports out until then.

- [ ] **Step 6: Write `src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Partek API')
    .setDescription(
      'B2B automotive parts marketplace for the Saudi/GCC market. ' +
        'Two purchasing paths: competitive RFQ bidding and direct catalog buying.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('audit')
    .addTag('notifications')
    .build();

  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logger.log(`Partek API listening on http://localhost:${port}`);
  logger.log(`Swagger UI at http://localhost:${port}/api`);
}

void bootstrap();
```

`whitelist` plus `forbidNonWhitelisted` means an unexpected property is a 400 rather than being silently dropped — which is what stops a caller from setting `priceLockedUntil` on a cart item in Phase 3c.

- [ ] **Step 7: Boot the application**

```bash
npm run build && npm run start:dev
```

Expected: the log lines above, no errors. Visit `http://localhost:3000/api` — Swagger renders with the `auth`, `users`, `audit`, and `notifications` tags.

- [ ] **Step 8: Verify the global guards are actually on**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/users/me
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' -d '{"email":"nobody@partek.test","password":"wrong-password"}'
```

Expected: `401` for both — the first because the route is protected and unauthenticated, the second because the credentials are invalid. A `200` or `404` on the first means `JwtAuthGuard` is not registered globally.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add exception filter, AppModule, bootstrap, and Swagger

The app boots. ValidationPipe runs with forbidNonWhitelisted so unknown
properties are rejected rather than dropped -- this is what stops a
caller from supplying server-controlled fields like priceLockedUntil.
Unrecognised errors return a generic 500 so connection strings and
queries never reach the client.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

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

## Task 20: Deterministic development seed

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: the complete schema, `PasswordService` hashing conventions.
- Produces: four known accounts (one per role) that the e2e test in Task 21 and the whole of Phase 3 rely on, plus reference data.

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, BrandType } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

/** Shared across every seeded account. Development only. */
const SEED_PASSWORD = 'Partek!Dev2026';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const accounts = [
    { email: 'admin@partek.sa', role: UserRole.admin },
    { email: 'vendor@partek.sa', role: UserRole.vendor },
    { email: 'client@partek.sa', role: UserRole.client },
    { email: 'driver@partek.sa', role: UserRole.delivery_agent },
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: { ...account, passwordHash, preferredLanguage: 'en' },
    });
  }

  const documentTypes = [
    { nameAr: 'السجل التجاري', nameEn: 'Commercial Registration', isRequired: true },
    { nameAr: 'شهادة ضريبة القيمة المضافة', nameEn: 'VAT Certificate', isRequired: true },
    { nameAr: 'رخصة البلدية', nameEn: 'Municipality License', isRequired: false },
    { nameAr: 'شهادة الآيبان', nameEn: 'IBAN Certificate', isRequired: true },
  ];
  for (const type of documentTypes) {
    const existing = await prisma.documentType.findFirst({
      where: { nameEn: type.nameEn },
    });
    if (!existing) await prisma.documentType.create({ data: type });
  }

  const categories = [
    { nameAr: 'المحرك', nameEn: 'Engine' },
    { nameAr: 'الفرامل', nameEn: 'Brakes' },
    { nameAr: 'التعليق', nameEn: 'Suspension' },
    { nameAr: 'الكهرباء', nameEn: 'Electrical' },
  ];
  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { nameEn: category.nameEn, parentId: null },
    });
    if (!existing) await prisma.category.create({ data: category });
  }

  const brands = [
    { nameAr: 'تويوتا الأصلية', nameEn: 'Toyota Genuine', brandType: BrandType.oem },
    { nameAr: 'بوش', nameEn: 'Bosch', brandType: BrandType.aftermarket },
    { nameAr: 'دينسو', nameEn: 'Denso', brandType: BrandType.aftermarket },
  ];
  for (const brand of brands) {
    const existing = await prisma.brand.findFirst({ where: { nameEn: brand.nameEn } });
    if (!existing) await prisma.brand.create({ data: brand });
  }

  const makes = [
    { nameAr: 'تويوتا', nameEn: 'Toyota', models: ['Hilux', 'Land Cruiser', 'Camry'] },
    { nameAr: 'نيسان', nameEn: 'Nissan', models: ['Patrol', 'Sunny'] },
    { nameAr: 'إيسوزو', nameEn: 'Isuzu', models: ['D-Max'] },
  ];
  for (const make of makes) {
    let record = await prisma.vehicleMake.findFirst({ where: { nameEn: make.nameEn } });
    record ??= await prisma.vehicleMake.create({
      data: { nameAr: make.nameAr, nameEn: make.nameEn },
    });

    for (const modelName of make.models) {
      let model = await prisma.vehicleModel.findFirst({
        where: { makeId: record.id, nameEn: modelName },
      });
      model ??= await prisma.vehicleModel.create({
        data: { makeId: record.id, nameAr: modelName, nameEn: modelName },
      });

      for (const year of [2022, 2023, 2024, 2025]) {
        const exists = await prisma.vehicle.findFirst({
          where: { makeId: record.id, modelId: model.id, year },
        });
        if (!exists) {
          await prisma.vehicle.create({
            data: { makeId: record.id, modelId: model.id, year },
          });
        }
      }
    }
  }

  const counts = {
    users: await prisma.user.count(),
    documentTypes: await prisma.documentType.count(),
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    vehicles: await prisma.vehicle.count(),
  };

  console.log('Seed complete:', counts);
  console.log(`All seeded accounts use the password: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Every insert is idempotent, so `npm run db:seed` can be re-run without duplicating rows. The production guard is there because `db:seed` against the wrong `DATABASE_URL` would otherwise create four known-password admin accounts in production.

- [ ] **Step 2: Run the seed**

```bash
npm run db:seed
```

Expected: `Seed complete: { users: 4, documentTypes: 4, categories: 4, brands: 3, vehicles: 24 }`.

- [ ] **Step 3: Verify idempotency**

```bash
npm run db:seed
```

Expected: identical counts. Any increase means an insert is not idempotent.

- [ ] **Step 4: Verify a seeded account can log in**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@partek.sa","password":"Partek!Dev2026"}' | head -c 200
```

Expected: JSON containing `accessToken`, `refreshToken`, and a `user` object with `"role":"admin"` and no `passwordHash`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add idempotent development seed

Four known-role accounts plus reference data. Every insert is an upsert
or find-then-create so re-running never duplicates. Refuses to run when
NODE_ENV=production -- seeding the wrong DATABASE_URL would otherwise
create known-password admin accounts in production.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 21: End-to-end auth cycle

**Files:**
- Create: `test/auth.e2e-spec.ts`
- Modify: `test/jest-e2e.json`

**Interfaces:**
- Consumes: the running application from Task 18 and the seeded accounts from Task 20.
- Produces: the e2e harness pattern (`createTestApp()`) that the Phase 3c bid-anonymity test reuses.

This is the gate for Phase 1. If it passes, the foundation is done.

- [ ] **Step 1: Update `test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/.*\\.e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@prisma-client$": "<rootDir>/generated/prisma/client"
  }
}
```

- [ ] **Step 2: Write the e2e test**

Create `test/auth.e2e-spec.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { PrismaService } from '@/database/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@partek.test`;
  const password = 'Partek!E2E2026';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  let accessToken: string;
  let refreshToken: string;

  it('registers a new account and returns a token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, role: 'client' })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.role).toBe('client');

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('never returns the password hash in any auth response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('$2b$');
  });

  it('rejects a duplicate registration with 409', () =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, role: 'client' })
      .expect(409));

  it('rejects an unknown property with 400', () =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'other@partek.test', password, role: 'client', isAdmin: true })
      .expect(400));

  it('rejects a protected route without a token', () =>
    request(app.getHttpServer()).get('/users/me').expect(401));

  it('accepts a protected route with a valid token', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(email);
  });

  it('forbids a client from the admin-only user list', () =>
    request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403));

  it('allows an admin to list users', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@partek.sa', password: 'Partek!Dev2026' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.total).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('rejects bad credentials with 401 and the same message as an unknown email', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'definitely-wrong' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@partek.test', password })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('exchanges a refresh token for a new pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).not.toBe(refreshToken);

    const previous = refreshToken;
    refreshToken = response.body.refreshToken;

    // Single-use: the old token must now be dead.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: previous })
      .expect(401);
  });

  it('revokes the refresh token on logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('treats logout with an unknown token as 204', () =>
    request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(204));

  it('rejects an access token whose user has been suspended', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    await prisma.user.update({
      where: { email },
      data: { status: 'suspended' },
    });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);

    await prisma.user.update({ where: { email }, data: { status: 'active' } });
  });
});
```

The suspension test is the one that proves the strategy re-reads status from the database rather than trusting the token — a still-valid signature must stop working the moment the account is suspended.

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: 13 PASS. Requires docker services up and the seed applied.

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`
Expected: all suites PASS — config, database constraints, audit extension, auth, users, audit, notifications, guards, filters.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add end-to-end auth cycle

Covers register, login, protected access, role gating, refresh rotation,
logout revocation, and mid-session suspension. Proves the JWT strategy
re-reads status from the database: a structurally valid token stops
working the moment the account is suspended.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Write the backend README**

Create `README.md` at the repo root documenting: prerequisites (Node 20+, Docker), `npm install`, `cp .env.example .env` plus generating the two JWT secrets with `openssl rand -hex 32`, `npm run db:up`, `npm run db:migrate`, `npm run db:seed`, `npm run start:dev`, the Swagger URL, the seeded accounts and their shared password, and the test commands. Note that Postgres binds to 5434, not the default 5432.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "docs: add backend README with setup instructions

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 1 Exit Criteria

Phase 1 is complete when all of the following hold:

- `npm run build` exits 0.
- `npm test` passes every suite.
- `npm run test:e2e` passes all 13 cases.
- `npm run start:dev` boots and Swagger renders at `http://localhost:3000/api`.
- `npm run db:seed` is idempotent across repeated runs.
- All 42 model tables exist (43 relations including `_prisma_migrations`), among them `refresh_tokens`.
- The four raw SQL constraints are provably enforced by `src/database/constraints.spec.ts`.
- An unauthenticated request to `/users/me` returns 401; a client-role request to `/users` returns 403.

## What Phase 1 deliberately does not deliver

Per the spec's out-of-scope list and phase table: no vendor, client, catalog, cart, RFQ, bid, PO, order, payment, disbursement, delivery, ZATCA, or returns modules. The queue processors and the storage service are stubs that log loudly. Real S3, PSP, and ZATCA integrations are never in scope for this plan.

## Next plans

- **Phase 2** — `partek-fe`, the Next.js wireframe. Written as its own plan; it depends on nothing in this one beyond the shapes in `prisma/schema.prisma`.
- **Phase 3a–3d** — the remaining backend domains, one plan per phase, each written when the prior phase is merged.
