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

