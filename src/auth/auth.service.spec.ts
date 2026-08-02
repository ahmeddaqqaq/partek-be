import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
    const unknownEmail = await service
      .login(dto as any, ctx)
      .catch((e) => e.message);

    repo.findUserByEmail.mockResolvedValue(buildUser());
    passwords.compare.mockResolvedValue(false);
    const wrongPassword = await service
      .login(dto as any, ctx)
      .catch((e) => e.message);

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
