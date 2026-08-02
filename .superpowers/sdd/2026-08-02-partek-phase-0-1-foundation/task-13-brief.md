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

