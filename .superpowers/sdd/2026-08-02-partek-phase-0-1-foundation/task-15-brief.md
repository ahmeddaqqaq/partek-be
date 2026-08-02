## Task 15: Users module

**Files:**
- Create: `src/users/users.repository.ts`
- Create: `src/users/users.service.ts`
- Create: `src/users/users.service.spec.ts`
- Create: `src/users/users.controller.ts`
- Create: `src/users/users.module.ts`
- Create: `src/users/dto/{create-user,update-user,user-response,list-users-query}.dto.ts`

**Interfaces:**
- Consumes: `PasswordService` from Task 11, `RolesGuard`/`@Roles` from Task 14.
- Produces:
  - `UsersRepository.findMany(filter)`, `.count(filter)`, `.findById(id)`, `.findByEmail(email)`, `.create(data)`, `.update(id, data)`, `.setStatus(id, status)`
  - `UsersService.list(query): Promise<Paginated<UserResponseDto>>`, `.findOne(id)`, `.create(dto)`, `.update(id, dto)`, `.changeRole(id, role, actor)`, `.setStatus(id, status)`
  - `Paginated<T> { data: T[]; total: number; page: number; pageSize: number }` — the pagination envelope every list endpoint in Phase 3 reuses.

- [ ] **Step 1: Write the DTOs**

`src/users/dto/user-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language, User, UserRole, UserStatus } from '@prisma-client';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiProperty({ enum: Language }) preferredLanguage: Language;
  @ApiPropertyOptional({ nullable: true }) lastLoginAt: Date | null;
  @ApiProperty() createdAt: Date;

  /**
   * The only permitted way to turn a User row into a response. There is no
   * passwordHash field on this class, so it cannot leak through spread or
   * serialization.
   */
  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
```

`src/users/dto/create-user.dto.ts`:

```ts
import { RegisterDto } from '@/auth/dto/register.dto';

export class CreateUserDto extends RegisterDto {}
```

`src/users/dto/update-user.dto.ts`:

```ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { UserRole, UserStatus } from '@prisma-client';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'role'] as const),
) {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
```

Password is omitted deliberately — changing a password is a separate flow with its own current-password check, not a field on a general update.

`src/users/dto/list-users-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole, UserStatus } from '@prisma-client';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive email substring' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
```

`pageSize` is capped at 100 so no caller can request the entire users table in one query.

- [ ] **Step 2: Write `src/users/users.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, User, UserStatus } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface UserFilter {
  role?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(filter: UserFilter): Prisma.UserWhereInput {
    return {
      role: filter.role as Prisma.UserWhereInput['role'],
      status: filter.status as Prisma.UserWhereInput['status'],
      email: filter.search
        ? { contains: filter.search, mode: 'insensitive' }
        : undefined,
    };
  }

  findMany(filter: UserFilter, skip: number, take: number): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.where(filter),
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(filter: UserFilter): Promise<number> {
    return this.prisma.user.count({ where: this.where(filter) });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  setStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }
}
```

- [ ] **Step 3: Write the failing service test**

Create `src/users/users.service.spec.ts`:

```ts
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Language, UserRole, UserStatus } from '@prisma-client';
import { UsersService } from './users.service';

const buildUser = (overrides: Partial<any> = {}) => ({
  id: 'user-1',
  email: 'buyer@fleet.sa',
  passwordHash: 'hashed',
  phone: null,
  role: UserRole.client,
  status: UserStatus.active,
  preferredLanguage: Language.en,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('UsersService', () => {
  let repo: any;
  let passwords: any;
  let audit: any;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findMany: jest.fn().mockResolvedValue([buildUser()]),
      count: jest.fn().mockResolvedValue(1),
      findById: jest.fn().mockResolvedValue(buildUser()),
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(buildUser()),
      update: jest.fn().mockResolvedValue(buildUser()),
      setStatus: jest.fn().mockResolvedValue(buildUser({ status: UserStatus.suspended })),
    };
    passwords = { hash: jest.fn().mockResolvedValue('hashed') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(repo, passwords, audit);
  });

  const actor = { id: 'admin-1', ipAddress: '127.0.0.1' };

  it('returns a paginated envelope', async () => {
    const result = await service.list({ page: 2, pageSize: 10 } as any);
    expect(result).toEqual({
      data: [expect.objectContaining({ id: 'user-1' })],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(repo.findMany).toHaveBeenCalledWith(expect.anything(), 10, 10);
  });

  it('never includes passwordHash in any listed user', async () => {
    const result = await service.list({ page: 1, pageSize: 25 } as any);
    expect(JSON.stringify(result)).not.toContain('hashed');
  });

  it('throws 404 for an unknown id', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects creating a user with a taken email', async () => {
    repo.findByEmail.mockResolvedValue(buildUser());
    await expect(
      service.create({ email: 'buyer@fleet.sa', password: 'x'.repeat(8), role: UserRole.client } as any, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('hashes the password on create', async () => {
    await service.create(
      { email: 'new@fleet.sa', password: 'correct-horse', role: UserRole.client } as any,
      actor,
    );
    expect(passwords.hash).toHaveBeenCalledWith('correct-horse');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed' }),
    );
  });

  it('writes an audit entry on role change', async () => {
    repo.update.mockResolvedValue(buildUser({ role: UserRole.admin }));
    await service.changeRole('user-1', UserRole.admin, actor);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        entityType: 'User',
        entityId: 'user-1',
        action: 'role_changed',
        previousState: { role: UserRole.client },
        newState: { role: UserRole.admin },
      }),
    );
  });

  it('refuses to change a role to the one already held', async () => {
    await expect(
      service.changeRole('user-1', UserRole.client, actor),
    ).rejects.toThrow(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('refuses to let an admin change their own role', async () => {
    repo.findById.mockResolvedValue(buildUser({ id: 'admin-1', role: UserRole.admin }));
    await expect(
      service.changeRole('admin-1', UserRole.client, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes an audit entry on status change', async () => {
    await service.setStatus('user-1', UserStatus.suspended, actor);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'status_changed' }),
    );
  });
});
```

Self-demotion is blocked because an admin who removes their own role in a single-admin deployment locks everyone out permanently.

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/users`
Expected: FAIL — `Cannot find module './users.service'`.

- [ ] **Step 5: Write `src/users/users.service.ts`**

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma-client';
import { PasswordService } from '@/auth/password.service';
import { AuditService } from '@/audit/audit.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActorContext {
  id: string;
  ipAddress: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<UserResponseDto>> {
    const filter = { role: query.role, status: query.status, search: query.search };
    const skip = (query.page - 1) * query.pageSize;

    const [users, total] = await Promise.all([
      this.repo.findMany(filter, skip, query.pageSize),
      this.repo.count(filter),
    ]);

    return {
      data: users.map(UserResponseDto.from),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.getOrThrow(id));
  }

  async create(dto: CreateUserDto, actor: ActorContext): Promise<UserResponseDto> {
    if (await this.repo.findByEmail(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.repo.create({
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      phone: dto.phone,
      role: dto.role,
      preferredLanguage: dto.preferredLanguage,
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: user.id,
      action: 'created',
      newState: { email: user.email, role: user.role },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const existing = await this.getOrThrow(id);

    if (dto.email && dto.email !== existing.email) {
      const clash = await this.repo.findByEmail(dto.email);
      if (clash) {
        throw new ConflictException('An account with this email already exists');
      }
    }

    const updated = await this.repo.update(id, {
      email: dto.email,
      phone: dto.phone,
      preferredLanguage: dto.preferredLanguage,
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: id,
      action: 'updated',
      previousState: { email: existing.email, phone: existing.phone },
      newState: { email: updated.email, phone: updated.phone },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(updated);
  }

  async changeRole(
    id: string,
    role: UserRole,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const existing = await this.getOrThrow(id);

    if (existing.id === actor.id) {
      throw new BadRequestException(
        'You cannot change your own role. Ask another admin.',
      );
    }
    if (existing.role === role) {
      throw new BadRequestException(`User already has the role "${role}"`);
    }

    const updated = await this.repo.update(id, { role });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: id,
      action: 'role_changed',
      previousState: { role: existing.role },
      newState: { role },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(updated);
  }

  async setStatus(
    id: string,
    status: UserStatus,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const existing = await this.getOrThrow(id);

    if (existing.id === actor.id) {
      throw new BadRequestException('You cannot change your own status');
    }

    const updated = await this.repo.setStatus(id, status);

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: id,
      action: 'status_changed',
      previousState: { status: existing.status },
      newState: { status },
      ipAddress: actor.ipAddress,
    });

    return UserResponseDto.from(updated);
  }

  private async getOrThrow(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
```

- [ ] **Step 6: Write `src/users/users.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole, UserStatus } from '@prisma-client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/auth/jwt.strategy';
import { UsersService, ActorContext } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user' })
  me(@CurrentUser('id') id: string): Promise<UserResponseDto> {
    return this.users.findOne(id);
  }

  @Get()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'List users (admin only)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Fetch one user (admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create a user (admin only)' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.users.create(dto, this.actor(user, req));
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update a user, including role and status' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const actor = this.actor(user, req);
    if (dto.role) await this.users.changeRole(id, dto.role, actor);
    if (dto.status) await this.users.setStatus(id, dto.status, actor);
    return this.users.update(id, dto, actor);
  }

  private actor(user: AuthenticatedUser, req: Request): ActorContext {
    return { id: user.id, ipAddress: req.ip ?? 'unknown' };
  }
}
```

Role and status changes route through their dedicated service methods rather than the generic update, so each produces its own distinct audit action rather than an opaque `updated`.

- [ ] **Step 7: Write `src/users/users.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
```

`AuthModule` must export `PasswordService` for this to resolve — add it to that module's `exports` array now.

- [ ] **Step 8: Run the tests**

Run: `npx jest src/users`
Expected: 9 PASS. `AuditService` is mocked, so it need not exist yet — but `tsc` requires it, so Task 16 follows immediately.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(users): add users module with role and status management

Role and status changes are separate service methods with their own
audit actions rather than fields on a generic update. Blocks self
role/status changes: an admin who demotes themselves in a single-admin
deployment locks everyone out permanently.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

