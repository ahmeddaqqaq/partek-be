## Task 18: Exception filter, AppModule, bootstrap, Swagger

**Files:**
- Create: `src/common/filters/all-exceptions.filter.ts`
- Create: `src/common/filters/all-exceptions.filter.spec.ts`
- Create: `src/common/interceptors/request-context.interceptor.ts`
- Create: `src/app.module.ts`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: every module from Tasks 9–17.
- Produces: a booting application, Swagger at `/api`, and the `ErrorResponse { statusCode, error, message, messageAr, constraint?, path, timestamp }` shape every endpoint returns on failure.

- [ ] **Step 1: Write the failing filter test**

Create `src/common/filters/all-exceptions.filter.spec.ts`:

```ts
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AuditAppendOnlyError } from '@/database/extensions/audit-append-only.extension';

const buildHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/test', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('passes an HttpException status through', () => {
    const { host, status, json } = buildHost();
    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Nope' }),
    );
  });

  it('maps Prisma P2002 to 409', () => {
    const { host, status } = buildHost();
    filter.catch({ name: 'PrismaClientKnownRequestError', code: 'P2002',
      meta: { target: ['email'] } }, host);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('maps Prisma P2025 to 404', () => {
    const { host, status } = buildHost();
    filter.catch({ name: 'PrismaClientKnownRequestError', code: 'P2025' }, host);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps Prisma P2003 to 400', () => {
    const { host, status } = buildHost();
    filter.catch({ name: 'PrismaClientKnownRequestError', code: 'P2003' }, host);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps a CHECK constraint violation to 422 with the constraint name', () => {
    const { host, status, json } = buildHost();
    filter.catch(
      { name: 'PrismaClientUnknownRequestError',
        message: 'violates check constraint "products_at_least_one_price"' },
      host,
    );
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ constraint: 'products_at_least_one_price' }),
    );
  });

  it('maps AuditAppendOnlyError to 403', () => {
    const { host, status } = buildHost();
    filter.catch(new AuditAppendOnlyError('update'), host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('returns 500 without leaking internals for an unknown error', () => {
    const { host, status, json } = buildHost();
    filter.catch(new Error('connection string is postgres://user:hunter2@db'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('always includes an Arabic message', () => {
    const { host, json } = buildHost();
    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);
    expect(json.mock.calls[0][0].messageAr).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/common/filters`
Expected: FAIL — `Cannot find module './all-exceptions.filter'`.

- [ ] **Step 3: Write `src/common/filters/all-exceptions.filter.ts`**

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuditAppendOnlyError } from '@/database/extensions/audit-append-only.extension';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  messageAr: string;
  constraint?: string;
  path: string;
  timestamp: string;
}

const AR: Record<number, string> = {
  400: 'طلب غير صالح',
  401: 'غير مصرح',
  403: 'ممنوع',
  404: 'غير موجود',
  409: 'تعارض في البيانات',
  422: 'البيانات لا تستوفي الشروط المطلوبة',
  500: 'خطأ في الخادم',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    const body = this.toBody(exception, request.url);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ErrorBody {
    const base = { path, timestamp: new Date().toISOString() };
    const withAr = (partial: Omit<ErrorBody, 'messageAr' | 'path' | 'timestamp'>) => ({
      ...partial,
      messageAr: AR[partial.statusCode] ?? AR[500],
      ...base,
    });

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return withAr({
        statusCode: status,
        error: exception.name,
        message: Array.isArray(message) ? message.join('; ') : message,
      });
    }

    if (exception instanceof AuditAppendOnlyError) {
      return withAr({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'AuditAppendOnly',
        message: exception.message,
      });
    }

    const err = exception as { name?: string; code?: string; message?: string; meta?: { target?: string[] } };

    if (err?.name === 'PrismaClientKnownRequestError') {
      switch (err.code) {
        case 'P2002': {
          const fields = err.meta?.target?.join(', ') ?? 'field';
          return withAr({
            statusCode: HttpStatus.CONFLICT,
            error: 'UniqueConstraintViolation',
            message: `A record with this ${fields} already exists`,
          });
        }
        case 'P2025':
          return withAr({
            statusCode: HttpStatus.NOT_FOUND,
            error: 'RecordNotFound',
            message: 'The requested record does not exist',
          });
        case 'P2003':
          return withAr({
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'ForeignKeyViolation',
            message: 'A referenced record does not exist',
          });
      }
    }

    // Raw CHECK constraints and triggers from the raw_constraints migration
    // surface here rather than as typed Prisma errors.
    const constraint = /(?:check constraint|CONSTRAINT) "([a-z0-9_]+)"/i.exec(
      err?.message ?? '',
    )?.[1];
    if (constraint) {
      return { ...withAr({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'ConstraintViolation',
        message: `The request violates the "${constraint}" rule`,
      }), constraint };
    }

    if (/append-only/i.test(err?.message ?? '')) {
      return withAr({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'AuditAppendOnly',
        message: 'Audit entries are immutable',
      });
    }

    // Never surface an unrecognised error's message: it may contain a
    // connection string, a query, or user data.
    return withAr({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Internal server error',
    });
  }
}
```

- [ ] **Step 4: Run to verify the filter tests pass**

Run: `npx jest src/common/filters`
Expected: 8 PASS.

- [ ] **Step 4b: Write `src/common/interceptors/request-context.interceptor.ts`**

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';

/**
 * Stamps every request with a correlation id, echoes it back as
 * x-request-id, and logs completion with duration. Phase 3 services read
 * `request.requestId` into the audit entry `metadata` so a log line and an
 * audit row can be tied to the same request.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const requestId = request.get('x-request-id') ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(
            `${request.method} ${request.url} ${response.statusCode} ` +
              `${Date.now() - startedAt}ms [${requestId}]`,
          ),
        error: () =>
          this.logger.warn(
            `${request.method} ${request.url} failed after ` +
              `${Date.now() - startedAt}ms [${requestId}]`,
          ),
      }),
    );
  }
}
```

An inbound `x-request-id` is honoured rather than overwritten, so a correlation id set by a gateway or by `partek-fe` survives into the API logs instead of being replaced at the boundary.

- [ ] **Step 5: Write `src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QueuesModule } from './queues/queues.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], cache: true }),
    PrismaModule,
    StorageModule,
    QueuesModule,
    AuthModule,
    UsersModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard populates request.user, which RolesGuard reads.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
```

Add `APP_INTERCEPTOR` to the `@nestjs/core` import alongside `APP_FILTER` and `APP_GUARD`.

`QueuesModule` and `StorageModule` arrive in Task 19 — comment those two imports out until then.

- [ ] **Step 6: Write `src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Partek API')
    .setDescription(
      'B2B automotive parts marketplace for the Saudi/GCC market. ' +
        'Two purchasing paths: competitive RFQ bidding and direct catalog buying.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('audit')
    .addTag('notifications')
    .build();

  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logger.log(`Partek API listening on http://localhost:${port}`);
  logger.log(`Swagger UI at http://localhost:${port}/api`);
}

void bootstrap();
```

`whitelist` plus `forbidNonWhitelisted` means an unexpected property is a 400 rather than being silently dropped — which is what stops a caller from setting `priceLockedUntil` on a cart item in Phase 3c.

- [ ] **Step 7: Boot the application**

```bash
npm run build && npm run start:dev
```

Expected: the log lines above, no errors. Visit `http://localhost:3000/api` — Swagger renders with the `auth`, `users`, `audit`, and `notifications` tags.

- [ ] **Step 8: Verify the global guards are actually on**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/users/me
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' -d '{"email":"nobody@partek.test","password":"wrong-password"}'
```

Expected: `401` for both — the first because the route is protected and unauthenticated, the second because the credentials are invalid. A `200` or `404` on the first means `JwtAuthGuard` is not registered globally.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add exception filter, AppModule, bootstrap, and Swagger

The app boots. ValidationPipe runs with forbidNonWhitelisted so unknown
properties are rejected rather than dropped -- this is what stops a
caller from supplying server-controlled fields like priceLockedUntil.
Unrecognised errors return a generic 500 so connection strings and
queries never reach the client.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

