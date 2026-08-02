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

