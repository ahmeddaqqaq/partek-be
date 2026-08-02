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
