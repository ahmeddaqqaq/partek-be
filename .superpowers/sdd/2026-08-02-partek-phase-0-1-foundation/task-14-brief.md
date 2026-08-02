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

