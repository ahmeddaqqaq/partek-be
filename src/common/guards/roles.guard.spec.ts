import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma-client';
import { RolesGuard } from './roles.guard';

const contextFor = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const stubMetadata = (isPublic: boolean, roles?: UserRole[]) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: any) => (key === 'isPublic' ? isPublic : roles));
  };

  it('allows a route with no @Roles metadata', () => {
    stubMetadata(false, undefined);
    expect(guard.canActivate(contextFor({ role: UserRole.client }))).toBe(true);
  });

  it('allows a public route with no authenticated user', () => {
    stubMetadata(true, [UserRole.admin]);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    stubMetadata(false, [UserRole.admin, UserRole.vendor]);
    expect(guard.canActivate(contextFor({ role: UserRole.vendor }))).toBe(true);
  });

  it('rejects a user whose role is not listed', () => {
    stubMetadata(false, [UserRole.admin]);
    expect(() =>
      guard.canActivate(contextFor({ role: UserRole.client })),
    ).toThrow(ForbiddenException);
  });

  it('rejects a protected role-gated route with no user', () => {
    stubMetadata(false, [UserRole.admin]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects rather than allows when @Roles is present but empty', () => {
    stubMetadata(false, []);
    expect(() => guard.canActivate(contextFor({ role: UserRole.admin }))).toThrow(
      ForbiddenException,
    );
  });
});
