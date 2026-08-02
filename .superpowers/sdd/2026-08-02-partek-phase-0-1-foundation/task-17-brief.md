## Task 17: Notifications module

**Files:**
- Create: `src/notifications/notifications.repository.ts`
- Create: `src/notifications/notifications.service.ts`
- Create: `src/notifications/notifications.service.spec.ts`
- Create: `src/notifications/notifications.controller.ts`
- Create: `src/notifications/notifications.module.ts`
- Create: `src/notifications/dto/{create-notification,notification-response,list-notifications-query}.dto.ts`

**Interfaces:**
- Consumes: `PrismaService`, `Paginated<T>` from Task 15.
- Produces: `NotificationsService.create(dto)`, `.listForUser(userId, query)`, `.markRead(id, userId)`, `.markAllRead(userId)`, `.unreadCount(userId)`. Phase 3 services call `create()` on vendor approval, bid award, order status change, and delivery events.

- [ ] **Step 1: Write the DTOs**

`src/notifications/dto/create-notification.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty({ example: 'vendor_approved' }) @IsString() notificationType: string;
  @ApiProperty() @IsString() titleAr: string;
  @ApiProperty() @IsString() titleEn: string;
  @ApiProperty() @IsString() messageAr: string;
  @ApiProperty() @IsString() messageEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
}
```

`src/notifications/dto/notification-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification } from '@prisma-client';

export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() notificationType: string;
  @ApiProperty() titleAr: string;
  @ApiProperty() titleEn: string;
  @ApiProperty() messageAr: string;
  @ApiProperty() messageEn: string;
  @ApiPropertyOptional({ nullable: true }) entityType: string | null;
  @ApiPropertyOptional({ nullable: true }) entityId: string | null;
  @ApiProperty() isRead: boolean;
  @ApiProperty() createdAt: Date;

  static from(n: Notification): NotificationResponseDto {
    return {
      id: n.id,
      notificationType: n.notificationType,
      titleAr: n.titleAr,
      titleEn: n.titleEn,
      messageAr: n.messageAr,
      messageEn: n.messageEn,
      entityType: n.entityType,
      entityId: n.entityId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }
}
```

Both language variants are always returned. The client picks based on the active locale, so a language switch never requires a refetch.

`src/notifications/dto/list-notifications-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter to unread only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 25;
}
```

- [ ] **Step 2: Write `src/notifications/notifications.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  findManyForUser(
    userId: string,
    unreadOnly: boolean,
    skip: number,
    take: number,
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countForUser(userId: string, unreadOnly: boolean): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: unreadOnly ? false : undefined },
    });
  }

  /** Scoped by userId so one user cannot mark another's notification read. */
  markRead(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true },
    });
  }

  markAllRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
```

`markRead` uses `updateMany` with both `id` and `userId` in the filter rather than `update` by primary key. A plain `update({ where: { id } })` would let any authenticated user mark any other user's notification read by guessing an ID.

- [ ] **Step 3: Write the failing service test**

Create `src/notifications/notifications.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const buildNotification = (overrides: Partial<any> = {}) => ({
  id: 'n-1',
  userId: 'user-1',
  notificationType: 'vendor_approved',
  titleAr: 'تمت الموافقة',
  titleEn: 'Approved',
  messageAr: 'تمت الموافقة على حسابك',
  messageEn: 'Your account was approved',
  entityType: 'Vendor',
  entityId: 'vendor-1',
  isRead: false,
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

describe('NotificationsService', () => {
  let repo: any;
  let service: NotificationsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(buildNotification()),
      findManyForUser: jest.fn().mockResolvedValue([buildNotification()]),
      countForUser: jest.fn().mockResolvedValue(1),
      markRead: jest.fn().mockResolvedValue({ count: 1 }),
      markAllRead: jest.fn().mockResolvedValue({ count: 3 }),
    };
    service = new NotificationsService(repo);
  });

  it('creates a notification with both language variants', async () => {
    const result = await service.create(buildNotification() as any);
    expect(result.titleAr).toBe('تمت الموافقة');
    expect(result.titleEn).toBe('Approved');
  });

  it('lists only the requesting user notifications', async () => {
    await service.listForUser('user-1', { page: 1, pageSize: 25 } as any);
    expect(repo.findManyForUser).toHaveBeenCalledWith('user-1', false, 0, 25);
  });

  it('filters to unread when asked', async () => {
    await service.listForUser('user-1', {
      unreadOnly: true, page: 1, pageSize: 25,
    } as any);
    expect(repo.findManyForUser).toHaveBeenCalledWith('user-1', true, 0, 25);
  });

  it('marks one notification read, scoped to its owner', async () => {
    await service.markRead('n-1', 'user-1');
    expect(repo.markRead).toHaveBeenCalledWith('n-1', 'user-1');
  });

  it('throws 404 when the notification is not the caller own', async () => {
    repo.markRead.mockResolvedValue({ count: 0 });
    await expect(service.markRead('n-1', 'other-user')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reports how many were marked read in bulk', async () => {
    await expect(service.markAllRead('user-1')).resolves.toEqual({ marked: 3 });
  });

  it('returns the unread count', async () => {
    await expect(service.unreadCount('user-1')).resolves.toBe(1);
    expect(repo.countForUser).toHaveBeenCalledWith('user-1', true);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/notifications`
Expected: FAIL — `Cannot find module './notifications.service'`.

- [ ] **Step 5: Write `src/notifications/notifications.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { Paginated } from '@/users/users.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    return NotificationResponseDto.from(await this.repo.create(dto));
  }

  async listForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<NotificationResponseDto>> {
    const unreadOnly = query.unreadOnly ?? false;
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.repo.findManyForUser(userId, unreadOnly, skip, query.pageSize),
      this.repo.countForUser(userId, unreadOnly),
    ]);

    return {
      data: items.map(NotificationResponseDto.from),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async markRead(id: string, userId: string): Promise<void> {
    const { count } = await this.repo.markRead(id, userId);
    if (count === 0) {
      // Covers "does not exist", "belongs to someone else", and "already
      // read" with one response, so IDs cannot be probed for existence.
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<{ marked: number }> {
    const { count } = await this.repo.markAllRead(userId);
    return { marked: count };
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.countForUser(userId, true);
  }
}
```

- [ ] **Step 6: Write `src/notifications/notifications.controller.ts`**

```ts
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user notifications' })
  list(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.listForUser(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  async unreadCount(@CurrentUser('id') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification read' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.notifications.markRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every notification read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
```

There is no route to list another user's notifications, and no `userId` parameter anywhere — the owner always comes from the token.

- [ ] **Step 7: Write `src/notifications/notifications.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 8: Run the tests**

Run: `npx jest src/notifications`
Expected: 7 PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(notifications): add bilingual per-user notifications module

Ownership always comes from the token -- no endpoint accepts a userId,
and markRead scopes by (id, userId) via updateMany so a guessed ID
cannot touch another user's row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

