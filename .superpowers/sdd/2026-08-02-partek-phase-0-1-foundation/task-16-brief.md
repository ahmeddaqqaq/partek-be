## Task 16: Audit module

**Files:**
- Create: `src/audit/audit.repository.ts`
- Create: `src/audit/audit.service.ts`
- Create: `src/audit/audit.service.spec.ts`
- Create: `src/audit/audit.controller.ts`
- Create: `src/audit/audit.module.ts`
- Create: `src/audit/dto/{audit-log-response,list-audit-query}.dto.ts`

**Interfaces:**
- Consumes: `PrismaService.audited` from Task 10.
- Produces: `AuditService.log(entry: AuditEntry): Promise<void>` and `.list(query)`. `AuditEntry { actorId, entityType, entityId, action, previousState?, newState?, metadata?, ipAddress }`. Every service in Phase 3 calls `log()` on significant state changes.

- [ ] **Step 1: Write `src/audit/audit.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
}

/**
 * Append-only by construction. This class deliberately exposes no update,
 * delete, or upsert method, and it goes through `prisma.audited` so that
 * any attempt added later throws at the ORM boundary. The database trigger
 * from the raw_constraints migration is the backstop.
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(filter: AuditFilter): Prisma.AuditLogWhereInput {
    return {
      entityType: filter.entityType,
      entityId: filter.entityId,
      actorId: filter.actorId,
      action: filter.action,
    };
  }

  create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return this.prisma.audited.auditLog.create({ data });
  }

  findMany(filter: AuditFilter, skip: number, take: number): Promise<AuditLog[]> {
    return this.prisma.audited.auditLog.findMany({
      where: this.where(filter),
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(filter: AuditFilter): Promise<number> {
    return this.prisma.audited.auditLog.count({ where: this.where(filter) });
  }
}
```

- [ ] **Step 2: Write the DTOs**

`src/audit/dto/audit-log-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditLog } from '@prisma-client';

export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() actorId: string;
  @ApiProperty() entityType: string;
  @ApiProperty() entityId: string;
  @ApiProperty() action: string;
  @ApiPropertyOptional({ nullable: true }) previousState: unknown;
  @ApiPropertyOptional({ nullable: true }) newState: unknown;
  @ApiPropertyOptional({ nullable: true }) metadata: unknown;
  @ApiProperty() ipAddress: string;
  @ApiProperty() createdAt: Date;

  static from(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      actorId: log.actorId,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      previousState: log.previousState,
      newState: log.newState,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    };
  }
}
```

`src/audit/dto/list-audit-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAuditQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize = 50;
}
```

- [ ] **Step 3: Write the failing service test**

Create `src/audit/audit.service.spec.ts`:

```ts
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let repo: any;
  let service: AuditService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    service = new AuditService(repo);
  });

  const entry = {
    actorId: 'admin-1',
    entityType: 'User',
    entityId: 'user-1',
    action: 'role_changed',
    previousState: { role: 'client' },
    newState: { role: 'admin' },
    ipAddress: '127.0.0.1',
  };

  it('persists an entry', async () => {
    await service.log(entry);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining(entry));
  });

  it('exposes no update or delete method', () => {
    expect((service as any).update).toBeUndefined();
    expect((service as any).delete).toBeUndefined();
    expect((service as any).remove).toBeUndefined();
  });

  it('never lets a logging failure break the caller', async () => {
    repo.create.mockRejectedValue(new Error('database is down'));
    await expect(service.log(entry)).resolves.toBeUndefined();
  });

  it('returns a paginated envelope', async () => {
    repo.findMany.mockResolvedValue([
      {
        id: 'log-1',
        actorId: 'admin-1',
        entityType: 'User',
        entityId: 'user-1',
        action: 'role_changed',
        previousState: null,
        newState: null,
        metadata: null,
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      },
    ]);
    repo.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, pageSize: 50 } as any);
    expect(result.total).toBe(1);
    expect(result.data[0].action).toBe('role_changed');
  });
});
```

The swallowed-failure test encodes a real decision: an audit write that fails must not roll back the business operation it describes. A failed role change because the log table was briefly unavailable is worse than a missing log line — the failure is logged to the application logger instead.

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/audit`
Expected: FAIL — `Cannot find module './audit.service'`.

- [ ] **Step 5: Write `src/audit/audit.service.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma-client';
import { AuditRepository } from './audit.repository';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';
import { Paginated } from '@/users/users.service';

export interface AuditEntry {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress: string;
}

/**
 * Append-only. There is no update, delete, or remove method on this class,
 * and none may be added -- see the raw_constraints migration and the
 * auditAppendOnly Prisma extension.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.create(entry);
    } catch (error) {
      // An audit write must never roll back the operation it describes.
      // Losing the business action is worse than losing the log line.
      this.logger.error(
        `Failed to write audit entry ${entry.action} on ${entry.entityType}:${entry.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(query: ListAuditQueryDto): Promise<Paginated<AuditLogResponseDto>> {
    const filter = {
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      action: query.action,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [logs, total] = await Promise.all([
      this.repo.findMany(filter, skip, query.pageSize),
      this.repo.count(filter),
    ]);

    return {
      data: logs.map(AuditLogResponseDto.from),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
```

- [ ] **Step 6: Write `src/audit/audit.controller.ts`**

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma-client';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

/**
 * Read-only by design. No POST, PATCH, PUT, or DELETE route exists here,
 * and none may be added: audit entries are written by services, never by
 * API callers.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Roles(UserRole.admin)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit entries (admin only, read-only)' })
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }
}
```

- [ ] **Step 7: Write `src/audit/audit.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 8: Run the tests**

Run: `npx jest src/audit src/users`
Expected: 13 PASS (4 audit + 9 users).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(audit): add append-only audit module

No update/delete method on the service, no mutating route on the
controller, and all writes go through prisma.audited. A failed audit
write logs and continues rather than rolling back the business operation
it describes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

