# SDD ledger — plan: /home/daqqaq/repos/partek-be-phase1/docs/superpowers/plans/2026-08-02-partek-phase-0-1-foundation.md

## Setup
- Repo renamed /home/daqqaq/repos/partek -> /home/daqqaq/repos/partek-be (done outside the loop, human-approved).
- Worktree: /home/daqqaq/repos/partek-be-phase1 on branch feat/phase-0-1-foundation, from master @ 51f125b.
- ALL 21 tasks execute in /home/daqqaq/repos/partek-be-phase1, NOT in partek-be.
- Task 1 Step 1 (the `mv`) is ALREADY DONE — implementers skip it.

## Pre-flight rulings (human-approved, park if a reviewer flags them)
- Task 5->6: Prisma back-relations are temporarily removed then restored. Intended.
- Task 11: empty placeholder TokenService, filled in at Task 13. Intended.
- Task 18: QueuesModule/StorageModule imports commented out until Task 19. Intended.
- Task 20: dev seed password hardcoded in prisma/seed.ts. Intended (guarded against NODE_ENV=production).
- Tests instantiate PrismaService directly, against the "repositories only" global constraint. Intended — the constraint binds services, not tests.

## Progress
- Task 1: BLOCKED on round 0 — plan defect: bullmq@^6.0.5 conflicts with @nestjs/bullmq@11 peer range (^3||^4||^5).
  Verified independently. Plan corrected to bullmq@^5.81.3 (commit on branch). Implementer resumed.
- Task 1: minor (deferred): npm audit — CRITICAL tar <- @mapbox/node-pre-gyp <- bcrypt@5 (install-time only,
  npm audit fix is non-breaking; real fix is bcrypt@6 which drops node-pre-gyp = plan pin change).
  HIGH js-yaml <- @nestjs/swagger (untrusted-YAML DoS, not reachable; npm's "fix" is a downgrade to 11.4.5).
  Neither reachable from an attacker-controlled request. FINAL REVIEW: triage before merge.
- Task 1: complete (commits 81a46d4..a2ef4fe, review clean — spec compliant, 0 critical/important, 2 minor both already tracked)
- Task 2: complete (commits a2ef4fe..dd0c97d, review clean — spec compliant, 0 critical/important).
  Reviewer minor was REAL and actioned forward: .env.example placeholders (36 chars) pass Task 9's
  minLength:32. Plan amended to add a PLACEHOLDER_PATTERN check + 2 tests before Task 9 executes.
- Task 3: plan defect #3 — Task 2 specified `url = env("DATABASE_URL")` in the datasource block;
  Prisma 7 rejects it (P1012) alongside prisma.config.ts + driver adapter. Implementer removed it
  (authorized deviation, verified by controller: prisma validate OK, migrate status resolves 5434).
  Plan corrected. NOTE: schema.prisma datasource now has provider only, no url.
- Task 3: complete (commits 52bc1f5..fa95d06, review clean — spec compliant, 0 critical/important).
  Reviewer ⚠️ (commit trailer unverifiable from diff) RESOLVED by controller: all 6 branch commits
  carry Co-Authored-By. Minors noted, no action: (a) UUIDs are client-side @default(uuid()), so any
  future raw-SQL insert path must supply its own — Task 8 tests and Task 20 seed both use Prisma
  Client, so unaffected; (b) no index on refresh_tokens.expires_at for a future pruning job.
- Task 4: plan defect #4 — table-count errors. Task 4 said "nine new tables" (8 models), Task 7 said
  "sixteen" (15), and "~46 models" appeared in the file map AND the Phase 1 exit criteria. True total
  is 42 models / 43 relations. Plan corrected; briefs 5-7 regenerated. Implementer flagged it rather
  than inventing a 9th model — correct call.
- Task 4: complete (commits cf3ee42..243c456, review clean — spec compliant, 0 critical/important,
  byte-for-byte match to brief incl. migration SQL). Reviewer minor ACTIONED forward: added
  CREATE INDEX on vendors.user_id and client_users.user_id to Task 8 (Postgres does not index FK
  columns; both are on the authorization path). Task 8 brief regenerated.
- Task 5: complete (commits d9b757f..de4e3c0, review clean — spec compliant, verbatim match incl.
  migration.sql; 5 deferred back-relations removed w/ markers for Task 6).
  OPEN (plan-mandated Important, escalated to human): Vehicle carries both makeId and modelId with no
  guard that VehicleModel.makeId agrees. A vehicle can claim make=Toyota while its model is a Honda
  Civic. Import resolver (Phase 3b) matches on make+model+year, so a mismatched row mis-associates
  parts to the wrong car. Proposed fix = composite FK in Task 8, no Prisma schema change.
- Task 6: complete (schema: Cart, CartItem, Rfq, RfqLineItem, Bid, BidLineItem, BidAwardSnapshot;
  migration 20260802151501_cart_rfq_bid). 4 of 6 back-relations restored; poLineItems left deferred
  on Product and BidLineItem for Task 7. Report written; NO review was run on this task — the loop
  stopped here. Task 6 is unreviewed. Flag at final review.

## REPO RESET (2026-08-02, human-directed) — read this before trusting any SHA above
- Git history was DELETED and the repo re-created from the working tree. Every commit SHA referenced
  above (81a46d4, a2ef4fe, dd0c97d, 52bc1f5, fa95d06, cf3ee42, 243c456, d9b757f, de4e3c0, dae0ffe)
  NO LONGER EXISTS. They are a record of what happened, not anything you can `git show`.
- The worktree layout is gone too. There is now ONE directory: /home/daqqaq/repos/partek-be on branch
  `main`, remote git@github.com:ahmeddaqqaq/partek-be.git. No `master`, no partek-be-phase1 worktree.
- New baseline: 7e5e81b "initial commit" — all of Tasks 1-6 squashed into one commit, plus the
  rescued src/database/prisma.service.spec.ts (orphaned by the Task 1 restructure, recovered before
  the old repo was deleted).
- Diff-based review across Tasks 1-6 is NO LONGER POSSIBLE. Reviews from Task 7 on diff against
  7e5e81b or later. The review-*.diff files in this directory are the only surviving record.
- `.superpowers/sdd/` is gitignored by its own .gitignore, so this ledger is LOCAL ONLY — it is not
  on GitHub and will not survive losing this directory.

- Task 7: complete. Restored both poLineItems back-relations; added the final 15 models
  (PurchaseOrder, PoLineItem, PoConfirmationSnapshot, Order, OrderStatusHistory, Payment,
  VendorDisbursement, PlatformFeeInvoice, DeliveryAgent, DeliveryTask, ProofOfDelivery, ZatcaInvoice,
  ReturnRequest, AuditLog, Notification); migration 20260802192636_orders_through_notifications.
  VERIFIED: prisma validate OK; 42 models in schema; 43 tables in Postgres (42 + _prisma_migrations),
  matching the exit criterion exactly; zero commented-out relations remain; tsc clean; jest 2/2 suites,
  4/4 tests. No new enums needed — all 10 already existed from Task 3.
  Plan defect #5 (same class as #4): both the plan (line 1260) and the task-7 brief said "the
  remaining 16 models" while the brief's own code blocks contained 15. 27 + 15 = 42 = exit criterion,
  so the code blocks were right and the prose was wrong. Corrected in both files rather than
  inventing a 16th model.
  NOT reviewed — no review step was run.

## SCHEMA IS NOW COMPLETE.

- Task 8: complete. Migration 20260802195200_raw_constraints. All 4 named constraints exist and are
  proven by src/database/constraints.spec.ts (7/7 pass): product_images_one_hero_per_product,
  products_at_least_one_price, purchase_orders_source_type_integrity, audit_logs_append_only
  (UPDATE + DELETE triggers). Plus the 9 deferred user-reference FKs and both authorization-path
  indexes from the Task 4 review.
  RESOLVED WITHOUT A HUMAN CALL: the Vehicle makeId/modelId escalation from Task 5. Implemented as
  UNIQUE (id, make_id) on vehicle_models + composite FK vehicles_model_belongs_to_make. Two tests
  cover it. Ahmed was asked three times and each time said "keep working", so the controller took
  the protective default. It is one ALTER TABLE ... DROP CONSTRAINT to reverse if he disagrees.

- Task 8 deviations from the brief (both were brief gaps, not implementer choices):
  (a) jest had no `setupFiles`, so DATABASE_URL never reached the test process and Prisma fell back
      to 127.0.0.1:5432 instead of 5434. constraints.spec.ts is the plan's FIRST db-touching test,
      so nothing caught this earlier. Added "setupFiles": ["dotenv/config"] to the jest config in
      package.json. Task 21's e2e suite would have hit the same wall.
  (b) Added @@index([userId]) to Vendor, @@index([userId]) to ClientUser, and @@unique([id, makeId])
      to VehicleModel — see defect #6 below.

## PLAN DEFECT #6 (open, needs a human decision) — schema.prisma vs database drift
- Task 8's brief creates objects in raw SQL that Prisma CAN represent. schema.prisma therefore no
  longer describes the database, and `npx prisma migrate dev` detects drift, tries to generate a
  "fix" migration, and BLOCKS ON AN INTERACTIVE PROMPT. This is not theoretical — it hung for 180s
  during Task 8 and had to be killed. Killing it truncated generated/prisma; `npx prisma generate`
  repaired it.
- Declaring the 3 representable index/unique objects in schema.prisma cut drift from 12 items to 10.
- The remaining 10 are all foreign keys: 9 user-reference FKs (Task 4 deliberately modelled these
  columns as plain uuid) plus the composite vehicles_model_belongs_to_make.
- CONSEQUENCE FOR EVERY LATER TASK: never run bare `npx prisma migrate dev` again on this project.
  Use `npx prisma migrate dev --create-only` and hand-write, or `npx prisma migrate deploy`.
- DECIDED: option (A) — accept the drift, mandate the --create-only workflow. Ahmed said "go"
  without picking, so the controller decided. The reasoning that settles it: option (B) does NOT
  actually buy back `migrate dev`. Prisma cannot express vehicles_model_belongs_to_make, because
  make_id is already consumed by the `make` relation, so a composite FK spanning it is not
  representable. (B) would therefore cost 9 relations plus ~9 back-relations on User and STILL
  leave drift, still requiring --create-only. (A) accepts one documented rule instead of paying
  for a fix that does not fix anything. Revisit only if the FK list grows.

## REVIEW of Tasks 6-8 (controller-run, 2026-08-02) — self-review, weaker than an independent pass
- Transcription: all 22 models from the task-6 and task-7 briefs compared field-by-field against
  schema.prisma after `prisma format`. 0 differences.
- Task 8 SQL: every statement in the brief was applied; the only additions beyond it are the two
  Vehicle composite-FK statements, which were deliberate.
- FINDING (real, fixed): purchase_orders_source_type_integrity was created but never tested. The
  brief's spec covered only 3 of the 4 named constraints, while the Phase 1 exit criteria claim
  "the four raw SQL constraints are provably enforced by src/database/constraints.spec.ts". Added
  3 tests (direct-without-cart rejected, rfq-without-bid rejected, valid direct accepted).
  constraints.spec.ts is now 10/10 and the exit criterion is genuinely met rather than assumed.
- Caveat: Tasks 7 and 8 were written by the same controller that reviewed them. An independent
  review is still worth running before merge.

- Task 9: complete. src/config/config.schema.ts (validateEnv + AppConfig) and a rewritten
  configuration.ts that is now just `validateEnv(process.env)`. TDD followed: the spec was written
  first and confirmed failing with "Cannot find module './config.schema'" before implementing.
  7/7 config tests pass; full suite 4 suites / 21 tests; tsc clean.
  The Task 2 carry-forward IS included — PLACEHOLDER_PATTERN rejects the .env.example secrets even
  though both are 36 chars and clear minLength:32. Verified against the literal values in
  .env.example, which still reads replace-me-access-secret-do-not-ship / replace-me-refresh-...
  EXTRA CHECK (not in the brief): ran validateEnv against the real .env. It passes, so Task 18's
  bootstrap will not fail on config. Worth knowing now rather than 9 tasks later.
  NOTE for Task 18: configuration.ts now THROWS on a bad environment instead of returning
  undefined values. That is the intended fail-fast behaviour, but it means any task that imports
  it outside a Nest context will throw at import time if the environment is incomplete.

- Task 10: complete. auditAppendOnly extension + AuditAppendOnlyError, exposed as
  PrismaService.audited. TDD followed: spec failed on "Property 'audited' does not exist" before
  implementing. 7/7 extension tests; full suite 5 suites / 28 tests; tsc clean.
  EXTRA TEST (not in the brief): "still blocks the base client, via the database trigger". Task 10's
  premise is a two-layer guarantee, but every test in the brief exercised only the extended client,
  so nothing proved layer 2 catches an ORM call that skips layer 1. It does — prisma.auditLog.update
  and .delete on the BASE client both reject with /append-only/ from the Task 8 trigger. The
  two-layer claim in the code comment is now verified rather than asserted.
  NOTE for Task 16: AuditRepository MUST use prisma.audited, not prisma. The base client reaches the
  database and fails there, but the error is a PrismaClientKnownRequestError from the driver rather
  than a legible AuditAppendOnlyError.
  NOTE for Task 18: AuditAppendOnlyError is exported and needs mapping in the exception filter.

- Task 11: complete. PasswordService, AuthRepository, AuthService.register, AuthTokensDto/AuthUserDto,
  expanded RegisterDto. TDD followed on both units (password service and register both confirmed
  failing on "Cannot find module" first). Full suite 7 suites / 39 tests; tsc clean.
- Task 11 deviations from the brief (both were brief defects):
  (a) PLAN DEFECT #7 — the brief said to create TokenService as an EMPTY class (`export class
      TokenService {}`) and claimed that satisfies tsc. It does not: AuthService.register calls
      this.tokens.issue(user, ctx), so an empty class fails with "Property 'issue' does not exist".
      Placeholder now declares the real signature and throws in the body, so a pre-Task-13 caller
      fails loudly instead of returning undefined tokens. TokenPair is exported from token.service.ts
      rather than auth.service.ts to avoid an import cycle — Task 13 should keep it there.
  (b) The brief said to update register.dto.spec.ts's third test to a 7-char password and "add
      role: 'client' to the two passing cases", but overlooked that the FIRST test's existing
      password 'pass123' is itself only 7 chars. Left as written it would fail its own
      expect(errors).toHaveLength(0) against the new MinLength(8). Changed to 'password123'.
- Task 11 extra coverage (not in the brief): RegisterDto gained @IsEnum(role), @Matches on a Saudi
  mobile, and @IsEnum(preferredLanguage), but the brief's spec asserted none of them. Added 3 tests
  — role missing, non-Saudi phone rejected, Saudi phone accepted. register.dto.spec.ts is now 6/6.
  The phone regex ^\+9665\d{8}$ accepts ONLY +9665XXXXXXXX, so landlines and non-Saudi numbers are
  rejected by design; revisit if the spec ever needs non-mobile contacts.

- Task 12: complete. AuthService.login + JwtStrategy (JwtPayload, AuthenticatedUser). TDD followed
  on both (login failed on "service.login is not a function", strategy on "Cannot find module").
  auth suite 25 tests; full suite 8 suites / 50 tests; tsc clean. No deviations from the brief.
  Account-enumeration defence is real and tested: one message for every failure mode, a bcrypt
  comparison runs even when no user exists, and a suspended account is indistinguishable from bad
  credentials. JwtStrategy re-reads role AND status from the database, so a token issued before a
  demotion or suspension does not retain the old rights.
  EXTRA CHECK (not in the brief): every login unit test mocks PasswordService, so nothing exercised
  the real DUMMY_HASH constant. If that literal were not a well-formed bcrypt hash, bcrypt.compare
  would THROW instead of resolving false, turning every unknown-email login into a 500 and undoing
  the whole enumeration defence. Verified against real bcrypt: resolves false. Task 21's e2e is the
  first place this would otherwise have surfaced.

- Task 13: complete. TokenRepository, the real TokenService (issue/rotate/revoke/revokeAllForUser),
  AuthService.refresh + logout, RefreshDto, AuthController, AuthModule. TDD followed on the token
  service. auth suite 36 tests; full suite 9 suites / 61 tests; tsc clean.
  Refresh tokens are opaque 256-bit random values stored as SHA-256 digests (not bcrypt — they are
  already full entropy, so there is nothing to brute-force, and lookup must be an indexed equality
  match). Rotation is single-use: the presented token is revoked before the replacement is issued.
- PLAN DEFECT #8 (fixed): the brief's TokenService does not typecheck. @nestjs/jwt types
  JwtSignOptions['expiresIn'] as the `ms` template-literal union, not `string`, so passing
  config.accessExpiresIn fails all three signAsync overloads. The value genuinely IS an arbitrary
  string (it comes from an env var), so it is cast at the call site with a comment rather than
  widening the type. A malformed value now fails inside jsonwebtoken at sign time.
  NOTE: refreshExpiry() validates JWT_REFRESH_EXPIRES_IN against /^(\d+)([smhd])$/ and throws a
  clear error, but JWT_ACCESS_EXPIRES_IN has NO equivalent validation — a typo there surfaces as a
  jsonwebtoken error on the first login instead of at boot. Candidate for Task 9's validateEnv.
- Task 13 extra coverage (not in the brief): AuthService.refresh and .logout shipped untested. Added
  3 tests. The important one asserts refresh does not leak passwordHash — refresh is the second
  place a full User crosses into a response DTO, and toAuthUser is what keeps it out.

- Task 14: complete. @Roles()/ROLES_KEY, RolesGuard, typed @CurrentUser() supporting both
  @CurrentUser() and @CurrentUser('id'). TDD followed. 6/6 guard tests; full suite 10 suites /
  67 tests; tsc clean.
  RolesGuard fails CLOSED on an empty @Roles() list — an argument-less decorator is far likelier a
  typo than an intentional "any authenticated user", and guessing wrong yields an open endpoint.
- Task 14 brief discrepancies (no action needed, recorded so a reviewer does not re-flag them):
  (a) The file list says "Modify: src/common/guards/jwt-auth.guard.ts", but no step modifies it and
      none is needed — it already reads IS_PUBLIC_KEY via getAllAndOverride and short-circuits.
      Left untouched deliberately.
  (b) The task TITLE says "global guard registration", but no step registers anything globally.
      That actually happens in Task 18 (APP_GUARD: JwtAuthGuard then RolesGuard, in that order —
      JwtAuthGuard populates request.user, which RolesGuard reads). Verified against the Task 18
      brief. Nothing is missing from Task 14; the title is just wrong.
- CONSEQUENCE: RolesGuard is written and unit-tested but NOT YET WIRED. No route is role-gated
  until Task 18 registers it. Do not treat "roles work" as true before then.

## Next: Task 15 (users module).
- Task 15 is the first consumer of @Roles() and @CurrentUser() on a real controller. Its /users
  (admin-only) and /users/me routes are exactly what the Phase 1 exit criteria assert:
  unauthenticated /users/me -> 401, client-role /users -> 403.
- Those two assertions CANNOT pass until Task 18 registers the guards globally. Expect Task 15's
  unit tests to pass while the e2e behaviour is still absent — that is the intended sequence.
- bcrypt is the Task 1 npm-audit item: CRITICAL tar <- @mapbox/node-pre-gyp <- bcrypt@5, install-time
  only. Now actually in use. Still deferred; triage before merge. Real fix is bcrypt@6.
- Tasks 6, 7, and 8 were reviewed by the controller (see above). Tasks 9-12 are UNREVIEWED.
  No independent review has run since Task 5. Flag at final review.
- Minor, deferred: constraints.spec.ts writes categories/products/users/vehicles to the dev database
  and never cleans up, so rows accumulate on every run. Harmless now; revisit if Task 20's seed
  idempotency check gets noisy.
