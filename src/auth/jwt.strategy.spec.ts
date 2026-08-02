import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus, Language } from '@prisma-client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
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

  let repo: any;
  let strategy: JwtStrategy;

  beforeEach(() => {
    repo = { findUserById: jest.fn().mockResolvedValue(user) };
    strategy = new JwtStrategy({ get: () => 'a'.repeat(32) } as any, repo);
  });

  const payload = {
    sub: 'user-1',
    email: 'buyer@fleet.sa',
    role: UserRole.client,
  };

  it('resolves the user from the token subject', async () => {
    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'user-1',
      email: 'buyer@fleet.sa',
      role: UserRole.client,
      status: UserStatus.active,
    });
  });

  it('never exposes the password hash', async () => {
    const result = await strategy.validate(payload);
    expect(JSON.stringify(result)).not.toContain('hashed');
  });

  it('rejects a token whose user no longer exists', async () => {
    repo.findUserById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose user has since been suspended', async () => {
    repo.findUserById.mockResolvedValue({
      ...user,
      status: UserStatus.suspended,
    });
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('reads the role from the database, not the token', async () => {
    repo.findUserById.mockResolvedValue({ ...user, role: UserRole.client });
    const result = await strategy.validate({
      ...payload,
      role: UserRole.admin,
    });
    expect(result.role).toBe(UserRole.client);
  });
});
