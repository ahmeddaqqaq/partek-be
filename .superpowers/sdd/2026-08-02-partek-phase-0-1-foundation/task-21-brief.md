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
- All ~46 tables exist, including `refresh_tokens`.
- The four raw SQL constraints are provably enforced by `src/database/constraints.spec.ts`.
- An unauthenticated request to `/users/me` returns 401; a client-role request to `/users` returns 403.

## What Phase 1 deliberately does not deliver

Per the spec's out-of-scope list and phase table: no vendor, client, catalog, cart, RFQ, bid, PO, order, payment, disbursement, delivery, ZATCA, or returns modules. The queue processors and the storage service are stubs that log loudly. Real S3, PSP, and ZATCA integrations are never in scope for this plan.

## Next plans

- **Phase 2** — `partek-fe`, the Next.js wireframe. Written as its own plan; it depends on nothing in this one beyond the shapes in `prisma/schema.prisma`.
- **Phase 3a–3d** — the remaining backend domains, one plan per phase, each written when the prior phase is merged.
