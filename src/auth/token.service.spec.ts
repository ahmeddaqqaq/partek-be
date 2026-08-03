import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus, Language } from '@prisma-client';
import { TokenService } from './token.service';

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

describe('TokenService', () => {
  let jwt: any;
  let repo: any;
  let authRepo: any;
  let service: TokenService;

  beforeEach(() => {
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
    repo = {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      findActiveByHash: jest.fn(),
      revokeById: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    authRepo = { findUserById: jest.fn().mockResolvedValue(user) };
    service = new TokenService(jwt, repo, authRepo, {
      accessSecret: 'a'.repeat(32),
      accessExpiresIn: '15m',
      refreshSecret: 'b'.repeat(32),
      refreshExpiresIn: '7d',
    });
  });

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  it('issues an access token and an opaque refresh token', async () => {
    const pair = await service.issue(user as any, ctx);
    expect(pair.accessToken).toBe('signed-access-token');
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stores the refresh token hashed, never in plaintext', async () => {
    const pair = await service.issue(user as any, ctx);
    const stored = repo.create.mock.calls[0][0];
    expect(stored.tokenHash).not.toBe(pair.refreshToken);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.userId).toBe('user-1');
  });

  it('signs the access token with sub, email, and role', async () => {
    await service.issue(user as any, ctx);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'user-1', email: 'buyer@fleet.sa', role: UserRole.client },
      expect.objectContaining({ expiresIn: '15m' }),
    );
  });

  it('rotates a valid refresh token and revokes the old one', async () => {
    repo.findActiveByHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });
    const result = await service.rotate('old-token', ctx);
    expect(repo.revokeById).toHaveBeenCalledWith('rt-1');
    expect(repo.create).toHaveBeenCalled();
    expect(result.refreshToken).not.toBe('old-token');
  });

  it('rejects an unknown, expired, or already-revoked refresh token', async () => {
    repo.findActiveByHash.mockResolvedValue(null);
    await expect(service.rotate('bad-token', ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects rotation when the user has since been suspended', async () => {
    repo.findActiveByHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });
    authRepo.findUserById.mockResolvedValue({
      ...user,
      status: UserStatus.suspended,
    });
    await expect(service.rotate('old-token', ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokes on logout', async () => {
    repo.findActiveByHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });
    await service.revoke('a-token');
    expect(repo.revokeById).toHaveBeenCalledWith('rt-1');
  });

  it('treats logout with an unknown token as a no-op', async () => {
    repo.findActiveByHash.mockResolvedValue(null);
    await expect(service.revoke('unknown')).resolves.toBeUndefined();
    expect(repo.revokeById).not.toHaveBeenCalled();
  });
});
