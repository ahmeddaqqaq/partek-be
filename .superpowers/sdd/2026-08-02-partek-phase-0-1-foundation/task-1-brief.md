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

