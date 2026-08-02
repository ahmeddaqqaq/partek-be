# partek-api Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a production-ready NestJS REST API with Prisma/PostgreSQL, JWT auth, Swagger docs, and DTO validation.

**Architecture:** Domain-driven module layout with `src/common/` for shared infrastructure (Prisma, Config, Guards, Decorators) and `src/modules/` for feature modules (auth, users). JWT guard is applied globally via `APP_GUARD`; individual public routes opt out with `@Public()`.

**Tech Stack:** NestJS 10, TypeScript 5, Prisma, PostgreSQL, `@nestjs/jwt` + Passport, `@nestjs/swagger`, `class-validator`, `@nestjs/mapped-types`, `date-fns`, `@nestjs/config`

---

## File Map

**Config (root):**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env` (not committed)

**Prisma:**
- Create: `prisma/schema.prisma`

**Source:**
- Create: `src/main.ts`
- Create: `src/app.module.ts`
- Create: `src/common/prisma/prisma.service.ts`
- Create: `src/common/prisma/prisma.service.spec.ts`
- Create: `src/common/prisma/prisma.module.ts`
- Create: `src/common/config/configuration.ts`
- Create: `src/common/guards/jwt-auth.guard.ts`
- Create: `src/common/decorators/public.decorator.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/modules/auth/dto/register.dto.ts`
- Create: `src/modules/auth/dto/login.dto.ts`
- Create: `src/modules/auth/dto/register.dto.spec.ts`
- Create: `src/modules/auth/jwt.strategy.ts`
- Create: `src/modules/auth/jwt.strategy.spec.ts`
- Create: `src/modules/auth/auth.service.ts`
- Create: `src/modules/auth/auth.service.spec.ts`
- Create: `src/modules/auth/auth.controller.ts`
- Create: `src/modules/auth/auth.controller.spec.ts`
- Create: `src/modules/auth/auth.module.ts`
- Create: `src/modules/users/dto/create-user.dto.ts`
- Create: `src/modules/users/dto/update-user.dto.ts`
- Create: `src/modules/users/dto/create-user.dto.spec.ts`
- Create: `src/modules/users/users.service.ts`
- Create: `src/modules/users/users.service.spec.ts`
- Create: `src/modules/users/users.controller.ts`
- Create: `src/modules/users/users.controller.spec.ts`
- Create: `src/modules/users/users.module.ts`

**Test:**
- Create: `test/jest-e2e.json`

---

## Task 1: Bootstrap project config files

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`
- Create: `.gitignore`
- Create: `test/jest-e2e.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "partek-api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/mapped-types": "^2.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@prisma/client": "^5.0.0",
    "bcrypt": "^5.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "date-fns": "^3.0.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "swagger-ui-express": "^5.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/passport-jwt": "^3.0.8",
    "@types/supertest": "^2.0.12",
    "jest": "^29.5.0",
    "prisma": "^5.0.0",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 4: Create `nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
/dist
/node_modules
/coverage
.env
*.log
.DS_Store
```

- [ ] **Step 6: Create `test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: dependencies installed, `node_modules/` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json tsconfig.build.json nest-cli.json .gitignore test/jest-e2e.json
git commit -m "chore: bootstrap project config"
```

---

## Task 2: Prisma schema and setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env`
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

```
DATABASE_URL=postgresql://user:password@localhost:5432/partek
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

- [ ] **Step 2: Create `.env`** (fill in your real PostgreSQL credentials)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/partek
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

- [ ] **Step 3: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 4: Run Prisma migration**

```bash
npx prisma migrate dev --name init
```

Expected output contains: `Your database is now in sync with your schema.`

- [ ] **Step 5: Verify Prisma client generated**

```bash
ls node_modules/.prisma/client/index.d.ts
```

Expected: file exists.

- [ ] **Step 6: Commit**

```bash
git add prisma/ .env.example
git commit -m "feat: add Prisma schema with User model"
```

---

## Task 3: PrismaService (TDD)

**Files:**
- Create: `src/common/prisma/prisma.service.spec.ts`
- Create: `src/common/prisma/prisma.service.ts`
- Create: `src/common/prisma/prisma.module.ts`

- [ ] **Step 1: Write the failing test**

`src/common/prisma/prisma.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest prisma.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './prisma.service'`

- [ ] **Step 3: Implement `PrismaService`**

`src/common/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- [ ] **Step 4: Create `PrismaModule`**

`src/common/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest prisma.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/common/prisma/
git commit -m "feat: add PrismaService and PrismaModule"
```

---

## Task 4: Config module

**Files:**
- Create: `src/common/config/configuration.ts`

- [ ] **Step 1: Create `configuration.ts`**

`src/common/config/configuration.ts`:
```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/common/config/
git commit -m "feat: add typed config factory"
```

---

## Task 5: Common decorators and JwtAuthGuard

**Files:**
- Create: `src/common/decorators/public.decorator.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/common/guards/jwt-auth.guard.ts`

- [ ] **Step 1: Create `@Public()` decorator**

`src/common/decorators/public.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Create `@CurrentUser()` decorator**

`src/common/decorators/current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 3: Create `JwtAuthGuard`**

`src/common/guards/jwt-auth.guard.ts`:
```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/common/decorators/ src/common/guards/
git commit -m "feat: add Public decorator, CurrentUser decorator, JwtAuthGuard"
```

---

## Task 6: Auth DTOs (TDD)

**Files:**
- Create: `src/modules/auth/dto/register.dto.spec.ts`
- Create: `src/modules/auth/dto/register.dto.ts`
- Create: `src/modules/auth/dto/login.dto.ts`

- [ ] **Step 1: Write the failing test**

`src/modules/auth/dto/register.dto.spec.ts`:
```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('passes with valid email and password', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'user@example.com', password: 'pass123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid email', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'not-an-email', password: 'pass123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('fails with password shorter than 6 characters', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'user@example.com', password: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest register.dto.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './register.dto'`

- [ ] **Step 3: Implement `RegisterDto`**

`src/modules/auth/dto/register.dto.ts`:
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
```

- [ ] **Step 4: Create `LoginDto`**

`src/modules/auth/dto/login.dto.ts`:
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest register.dto.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth/dto/
git commit -m "feat: add auth DTOs with validation"
```

---

## Task 7: JWT Strategy (TDD)

**Files:**
- Create: `src/modules/auth/jwt.strategy.spec.ts`
- Create: `src/modules/auth/jwt.strategy.ts`

- [ ] **Step 1: Write the failing test**

`src/modules/auth/jwt.strategy.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('validate returns user object from JWT payload', async () => {
    const payload = { sub: 'user-id-1', email: 'a@b.com' };
    expect(await strategy.validate(payload)).toEqual({ id: 'user-id-1', email: 'a@b.com' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest jwt.strategy.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './jwt.strategy'`

- [ ] **Step 3: Implement `JwtStrategy`**

`src/modules/auth/jwt.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest jwt.strategy.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/jwt.strategy.ts src/modules/auth/jwt.strategy.spec.ts
git commit -m "feat: add JWT Passport strategy"
```

---

## Task 8: AuthService (TDD)

**Files:**
- Create: `src/modules/auth/auth.service.spec.ts`
- Create: `src/modules/auth/auth.service.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/auth/auth.service.spec.ts`:
```typescript
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException if email already in use', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com' });
      await expect(
        service.register({ email: 'a@b.com', password: 'pass123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns access_token on success', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com' });
      const result = await service.register({ email: 'a@b.com', password: 'pass123' });
      expect(result).toEqual({ access_token: 'mock-token' });
    });

    it('hashes the password before storing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com' });
      await service.register({ email: 'a@b.com', password: 'pass123' });
      const storedPassword = prisma.user.create.mock.calls[0][0].data.password;
      const matches = await bcrypt.compare('pass123', storedPassword);
      expect(matches).toBe(true);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@b.com', password: 'pass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if password is wrong', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com', password: hashed });
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token on valid credentials', async () => {
      const hashed = await bcrypt.hash('pass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com', password: hashed });
      const result = await service.login({ email: 'a@b.com', password: 'pass123' });
      expect(result).toEqual({ access_token: 'mock-token' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest auth.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: Implement `AuthService`**

`src/modules/auth/auth.service.ts`:
```typescript
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashed },
    });

    return this.signToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.signToken(user.id, user.email);
  }

  private signToken(userId: string, email: string) {
    return {
      access_token: this.jwtService.sign({ sub: userId, email }),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest auth.service.spec.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/auth.service.ts src/modules/auth/auth.service.spec.ts
git commit -m "feat: add AuthService with register and login"
```

---

## Task 9: AuthController (TDD)

**Files:**
- Create: `src/modules/auth/auth.controller.spec.ts`
- Create: `src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/auth/auth.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue({ access_token: 'token' }),
      login: jest.fn().mockResolvedValue({ access_token: 'token' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('register delegates to authService and returns token', async () => {
    const dto = { email: 'a@b.com', password: 'pass123' };
    const result = await controller.register(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'token' });
  });

  it('login delegates to authService and returns token', async () => {
    const dto = { email: 'a@b.com', password: 'pass123' };
    const result = await controller.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'token' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest auth.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './auth.controller'`

- [ ] **Step 3: Implement `AuthController`**

`src/modules/auth/auth.controller.ts`:
```typescript
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest auth.controller.spec.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/auth.controller.ts src/modules/auth/auth.controller.spec.ts
git commit -m "feat: add AuthController"
```

---

## Task 10: AuthModule

**Files:**
- Create: `src/modules/auth/auth.module.ts`

- [ ] **Step 1: Create `AuthModule`**

`src/modules/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/auth/auth.module.ts
git commit -m "feat: wire up AuthModule"
```

---

## Task 11: User DTOs (TDD)

**Files:**
- Create: `src/modules/users/dto/create-user.dto.spec.ts`
- Create: `src/modules/users/dto/create-user.dto.ts`
- Create: `src/modules/users/dto/update-user.dto.ts`

- [ ] **Step 1: Write the failing test**

`src/modules/users/dto/create-user.dto.spec.ts`:
```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  it('passes with valid fields', async () => {
    const dto = plainToInstance(CreateUserDto, { email: 'user@example.com', password: 'pass123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid email', async () => {
    const dto = plainToInstance(CreateUserDto, { email: 'bad', password: 'pass123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('fails with short password', async () => {
    const dto = plainToInstance(CreateUserDto, { email: 'user@example.com', password: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest create-user.dto.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './create-user.dto'`

- [ ] **Step 3: Implement `CreateUserDto`**

`src/modules/users/dto/create-user.dto.ts`:
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
```

- [ ] **Step 4: Create `UpdateUserDto`**

`src/modules/users/dto/update-user.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest create-user.dto.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/users/dto/
git commit -m "feat: add user DTOs with mapped-types"
```

---

## Task 12: UsersService (TDD)

**Files:**
- Create: `src/modules/users/users.service.spec.ts`
- Create: `src/modules/users/users.service.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/users/users.service.spec.ts`:
```typescript
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from './users.service';

const mockUser = {
  id: 'cuid1',
  email: 'a@b.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('findAll returns list of users', async () => {
    prisma.user.findMany.mockResolvedValue([mockUser]);
    expect(await service.findAll()).toEqual([mockUser]);
  });

  it('findOne returns user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    expect(await service.findOne('cuid1')).toEqual(mockUser);
  });

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('update patches user fields', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    const updated = { ...mockUser, email: 'new@b.com' };
    prisma.user.update.mockResolvedValue(updated);
    const result = await service.update('cuid1', { email: 'new@b.com' });
    expect(result.email).toBe('new@b.com');
  });

  it('update throws NotFoundException for unknown id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.update('bad-id', { email: 'x@y.com' })).rejects.toThrow(NotFoundException);
  });

  it('remove deletes user', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.delete.mockResolvedValue(mockUser);
    await service.remove('cuid1');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'cuid1' } });
  });

  it('remove throws NotFoundException for unknown id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest users.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './users.service'`

- [ ] **Step 3: Implement `UsersService`**

`src/modules/users/users.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ select: USER_SELECT });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest users.service.spec.ts --no-coverage
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/users/users.service.ts src/modules/users/users.service.spec.ts
git commit -m "feat: add UsersService with CRUD"
```

---

## Task 13: UsersController (TDD)

**Files:**
- Create: `src/modules/users/users.controller.spec.ts`
- Create: `src/modules/users/users.controller.ts`

- [ ] **Step 1: Write the failing tests**

`src/modules/users/users.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockUser = { id: 'cuid1', email: 'a@b.com', createdAt: new Date(), updatedAt: new Date() };

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: any;

  beforeEach(async () => {
    usersService = {
      findAll: jest.fn().mockResolvedValue([mockUser]),
      findOne: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue({ ...mockUser, email: 'new@b.com' }),
      remove: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('findAll returns all users', async () => {
    expect(await controller.findAll()).toEqual([mockUser]);
  });

  it('findOne returns a user by id', async () => {
    expect(await controller.findOne('cuid1')).toEqual(mockUser);
    expect(usersService.findOne).toHaveBeenCalledWith('cuid1');
  });

  it('update calls service with id and dto', async () => {
    const dto = { email: 'new@b.com' };
    const result = await controller.update('cuid1', dto);
    expect(usersService.update).toHaveBeenCalledWith('cuid1', dto);
    expect(result.email).toBe('new@b.com');
  });

  it('remove calls service with id', async () => {
    await controller.remove('cuid1');
    expect(usersService.remove).toHaveBeenCalledWith('cuid1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest users.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './users.controller'`

- [ ] **Step 3: Implement `UsersController`**

`src/modules/users/users.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest users.controller.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/users/users.controller.ts src/modules/users/users.controller.spec.ts
git commit -m "feat: add UsersController"
```

---

## Task 14: UsersModule

**Files:**
- Create: `src/modules/users/users.module.ts`

- [ ] **Step 1: Create `UsersModule`**

`src/modules/users/users.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/users/users.module.ts
git commit -m "feat: wire up UsersModule"
```

---

## Task 15: AppModule

**Files:**
- Create: `src/app.module.ts`

- [ ] **Step 1: Create `AppModule`**

`src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './common/config/configuration';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: wire up AppModule with global JWT guard"
```

---

## Task 16: main.ts and final verification

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Create `main.ts`**

`src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  if (config.get('nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Partek API')
      .setDescription('The Partek API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
```

- [ ] **Step 2: Run all unit tests**

```bash
npm test -- --no-coverage
```

Expected: all spec files pass, no failures.

- [ ] **Step 3: Start the dev server**

```bash
npm run start:dev
```

Expected: logs show `Application running on: http://localhost:3000` and `Swagger docs: http://localhost:3000/api/docs`. No startup errors.

- [ ] **Step 4: Verify Swagger UI**

Open `http://localhost:3000/api/docs` in a browser.
Expected: Swagger UI loads with `auth` and `users` tag groups visible.

- [ ] **Step 5: Smoke test register endpoint**

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}' | jq .
```

Expected: `{ "access_token": "<jwt-string>" }`

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: configure main.ts with ValidationPipe, Swagger, and CORS"
```
