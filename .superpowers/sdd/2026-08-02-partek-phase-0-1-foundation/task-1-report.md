# Task 1 Report: Rename repo, upgrade toolchain, restructure source

## Status: DONE

## Sequence of events

Work started, hit a real `ERESOLVE` peer-dependency conflict in Step 2 between
`@nestjs/bullmq@^11.0.4` (peer range `bullmq: ^3||^4||^5`) and the brief's
originally-specified `bullmq@^6.0.5`. Reported it (per instructions not to
silently substitute a different major) instead of guessing a fix. The
coordinator confirmed the analysis, corrected the plan/brief in commit
`81a46d4` (`bullmq@^5.81.3` instead of `^6.0.5`), and directed me to resume
from Step 2 with the corrected brief. This report covers the full run,
Steps 2-8, using the corrected version.

## What was implemented

**Step 2 — dependency upgrade.** Ran the brief's exact `npm install` command
for prod deps first; it failed with a *different*, transitional `ERESOLVE`
(old `@nestjs/testing@^10.0.0` still on disk in `devDependencies`, conflicting
with the new `@nestjs/common@^11.1.28` being installed). This is an artifact
of running the two `npm install` commands sequentially against an
already-populated `package.json` — not a real version incompatibility. I
resolved it by editing `package.json`'s `dependencies`/`devDependencies`
blocks directly to the exact versions listed in the brief (all of them,
verbatim — no substitutions) and running a single `npm install` with no
arguments, so npm resolves the whole graph in one pass. Verified via
`npm ls` afterward that every package resolved to exactly the version
specified in the brief (e.g. `bullmq@5.81.3`, `@nestjs/bullmq@11.0.4`,
`@prisma/client@7.9.1`, `typescript@5.9.3`, etc. — all matched).

`npm audit` reports 4 vulnerabilities (3 high, 1 critical) in transitive
deps: `js-yaml` (via `@nestjs/swagger`) and `tar` (via `bcrypt`'s
`@mapbox/node-pre-gyp`). Not acted on — `audit fix --force` would downgrade
`@nestjs/swagger` to a version outside the brief's pin, which is out of
scope for this task and against the "don't silently pick a different
version" instruction. Flagging for awareness.

**Step 3 — restructure directories.** Ran the brief's commands verbatim:
created `src/config`, `src/database/extensions`, `src/common/{decorators,
guards,filters,interceptors,pipes,storage}`, `src/auth/dto`, `src/queues`;
`git mv`'d `configuration.ts`, `prisma.service.ts`, `prisma.module.ts`,
`login.dto.ts`, `register.dto.ts`, `register.dto.spec.ts` to their new
locations; `git rm`'d `prisma.service.spec.ts`; removed now-empty
`src/common/config`, `src/common/prisma`, `src/modules/auth/dto` (and the
now-empty `src/modules` parent). Git correctly tracked all of these as
renames (confirmed via `git status`).

**Step 4 — tsconfig.json.** Replaced verbatim with the brief's exact JSON
(target ES2023, strict flags turned on, `@/*` and `@prisma-client` path
aliases, `include`/`exclude`).

**Step 5 — package.json scripts/jest.** Replaced verbatim with the brief's
exact `scripts` and `jest` blocks (`db:*` scripts added, `test:e2e` gets
`--runInBand`, Jest `rootDir` moved to `.` with `roots: ["<rootDir>/src"]`
and the matching `moduleNameMapper` aliases).

**Step 6 — .gitignore.** Added `/generated`, matching the brief exactly.

**Step 7 — verify.** `npx tsc --noEmit` initially surfaced three errors:
1. `src/config/configuration.ts(2,18)`: `parseInt(process.env.PORT, 10)` —
   `process.env.PORT` is `string | undefined`, which the newly-enabled
   `strictNullChecks` (Step 4) now rejects. This is neither of the two
   "expected" buckets (not Prisma-client-related, not main.ts-related) —
   it's a real latent bug this task's own tsconfig upgrade exposed in a file
   the brief only asked me to *move*. Per the same judgment call the brief
   applies to the guard file ("if NestJS 11 breaks it, fix it now"), I fixed
   it minimally: `parseInt(process.env.PORT ?? '', 10) || 3000` — preserves
   the original fallback-to-3000 behavior, satisfies the stricter type.
2. `src/database/prisma.service.ts(2,10)` and `(7,16)`: `Module
   "@prisma/client" has no exported member 'PrismaClient'` / `Property
   '$connect' does not exist`. These are the expected "no Prisma client
   generated yet" errors — `@prisma/client@7.9.1` is installed but no schema
   or `prisma generate` has run (Task 3's job), so the package exports
   nothing yet. Note: the file still imports from `'@prisma/client'`, not
   the literal string `'@prisma-client'` (nothing in the tree references the
   alias yet — Task 3 wires that up), so the error text differs slightly
   from the brief's phrasing, but it's the same underlying condition the
   brief describes parenthetically ("no Prisma client has been generated
   yet"). Left as-is; not in scope for this task.

Final `npx tsc --noEmit` output (after the configuration.ts fix):
```
src/database/prisma.service.ts(2,10): error TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'.
src/database/prisma.service.ts(7,16): error TS2339: Property '$connect' does not exist on type 'PrismaService'.
```
No `main.ts`-related error appears — `tsc --noEmit` type-checks the
`include` glob and doesn't require an entry point to exist; nothing
references `src/main.ts`, so there's nothing to error on. This is expected
tool behavior, not a gap. No NestJS 11 API errors anywhere, including
`jwt-auth.guard.ts` (its `Reflector.getAllAndOverride` usage compiles clean
under v11, as the brief predicted).

**Step 8 — commit.** `git add -A` (reviewed `git status` first — only the
brief's expected files plus `package-lock.json`, nothing suspicious),
committed with the exact message from the brief on top of `81a46d4`
(the plan-fix commit), without amending or rebasing:

```
a2ef4fe chore: rename to partek-be, upgrade to NestJS 11 + Prisma 7, restructure src
81a46d4 fix(plan): pin bullmq to ^5.81.3 for @nestjs/bullmq peer compatibility
```

## Files changed

- `package.json` — deps/devDeps upgraded to brief's exact versions; scripts
  and jest block replaced verbatim
- `package-lock.json` — new, regenerated by install
- `tsconfig.json` — rewritten verbatim per Step 4
- `.gitignore` — added `/generated`
- `src/config/configuration.ts` — moved from `src/common/config/`; one-line
  fix for strictNullChecks (`process.env.PORT ?? ''`)
- `src/database/prisma.service.ts` — moved from `src/common/prisma/`,
  unmodified otherwise
- `src/database/prisma.module.ts` — moved from `src/common/prisma/`,
  unmodified
- `src/common/prisma/prisma.service.spec.ts` — deleted (per brief, rewritten
  in Task 10)
- `src/auth/dto/login.dto.ts`, `register.dto.ts`, `register.dto.spec.ts` —
  moved from `src/modules/auth/dto/`, unmodified
- New empty dirs created (not tracked by git until populated by later
  tasks): `src/config`, `src/database/extensions`, `src/common/{filters,
  interceptors,pipes,storage}`, `src/queues`

## Self-review

- All 7 steps (2-8) completed; Step 1 correctly skipped per coordinator
  instructions.
- No scope creep: did not create `main.ts`, `app.module.ts`, or any Prisma
  schema/models. Did not touch `/home/daqqaq/repos/partek-be`.
- Directory layout matches the expected end state exactly: `src/config/`,
  `src/database/`, `src/common/{decorators,guards,filters,interceptors,
  pipes,storage}`, `src/auth/dto/`, `src/queues/` all present.
- `git mv` was used throughout so history/blame is preserved on all moved
  files (confirmed via `git status` showing "renamed:", not "deleted" +
  "new file").
- Verified installed versions against the brief with `npm ls` — every
  package matched exactly (including the corrected `bullmq@5.81.3`).
- Deviated from a literal reading of Step 2's two-command sequence (ran a
  single `npm install` against an edited `package.json` instead of the two
  separate `npm install` / `npm install -D` commands) to route around an
  npm dependency-resolution ordering artifact — same final `package.json`
  content and installed versions either way, no version substitutions made.
- Fixed one unexpected tsc error (`configuration.ts`) that fell outside the
  brief's two expected buckets, using the same judgment call the brief
  explicitly authorizes for the guard file.
- Final `tsc --noEmit` output contains only the anticipated
  Prisma-client-not-generated errors; no NestJS 11 API errors.

## Issues / concerns for the record

1. **Plan defect (already fixed upstream):** original brief's
   `bullmq@^6.0.5` conflicted with `@nestjs/bullmq@^11.0.4`'s peer range.
   Corrected in commit `81a46d4` before I resumed; not a residual concern.
2. **npm audit:** 4 vulnerabilities (3 high, 1 critical) in transitive deps
   `js-yaml` (via `@nestjs/swagger`) and `tar` (via `bcrypt`). Not remediated
   — fixing would require version changes outside this task's pinned list.
   Flagging for whoever owns dependency hygiene later in the plan.
3. **`configuration.ts` behavior fix:** the one-character-class fix
   (`?? ''`) is a compile-time-only change; runtime behavior for
   `process.env.PORT` unset/invalid is unchanged (still falls back to 3000).
