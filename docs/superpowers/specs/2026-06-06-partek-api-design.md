# partek-api Design Spec
**Date:** 2026-06-06

## Overview

A full product REST API built with NestJS (TypeScript), PostgreSQL via Prisma, JWT authentication, and Swagger documentation.

## Architecture

Domain-driven module structure with a shared infrastructure layer:

```
partek-api/
├── src/
│   ├── common/
│   │   ├── prisma/          # PrismaService + PrismaModule
│   │   ├── config/          # Typed config via @nestjs/config
│   │   ├── guards/          # JwtAuthGuard
│   │   ├── decorators/      # @CurrentUser(), @Public()
│   │   └── pipes/           # ValidationPipe setup
│   ├── modules/
│   │   ├── auth/            # login, register, JWT strategy
│   │   └── users/           # CRUD, DTOs with mapped-types
│   └── app.module.ts
├── prisma/
│   └── schema.prisma        # User model to start
├── .env
├── .env.example
└── main.ts                  # Global pipes, swagger setup, CORS
```

## Packages

| Package | Purpose |
|---|---|
| `@nestjs/swagger` + `swagger-ui-express` | Auto-generated API docs at `/api/docs` |
| `class-validator` + `class-transformer` | DTO validation via global `ValidationPipe` |
| `@nestjs/mapped-types` | `PartialType`, `PickType`, `OmitType` for DTO inheritance |
| `date-fns` | Date formatting/manipulation utilities |
| `@nestjs/jwt` + `passport-jwt` + `@nestjs/passport` | JWT signing, Passport strategy, auth guards |
| `@nestjs/config` | `.env` loading, typed `ConfigService` |
| `prisma` + `@prisma/client` | DB schema, migrations, type-safe queries |
| `bcrypt` + `@types/bcrypt` | Password hashing |

## Auth Flow

1. `POST /auth/register` — validates `CreateUserDto`, hashes password (bcrypt), creates user via Prisma, returns JWT
2. `POST /auth/login` — validates credentials, returns signed JWT
3. Protected routes use `JwtAuthGuard` applied globally; skipped with `@Public()` decorator
4. `@CurrentUser()` decorator extracts user from JWT payload on protected routes

## Data Flow

```
Request → Controller → Service → PrismaService → PostgreSQL
                ↑
         ValidationPipe (class-validator)
         DTO types via mapped-types
```

## Prisma Schema

Starting model:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Environment Variables

```
DATABASE_URL=postgresql://user:password@localhost:5432/partek
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

## Key Conventions

- Global `ValidationPipe` with `whitelist: true` and `transform: true`
- Swagger enabled only when `NODE_ENV !== 'production'`, mounted at `/api/docs`
- CORS enabled in `main.ts`
- `@Public()` decorator marks routes that skip JWT guard
- `UpdateUserDto extends PartialType(CreateUserDto)` pattern for all update DTOs
