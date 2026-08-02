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

