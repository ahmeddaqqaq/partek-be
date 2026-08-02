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
  url      = env("DATABASE_URL")
}
```

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

