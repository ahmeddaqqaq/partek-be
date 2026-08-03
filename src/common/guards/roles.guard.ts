import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma-client';
import { AuthenticatedUser } from '@/auth/jwt.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) return true;

    const user = context.switchToHttp().getRequest().user as
      | AuthenticatedUser
      | undefined;

    // An empty @Roles() list denies rather than permits: it is far more
    // likely a mistake than an intentional "anyone authenticated".
    if (!user || required.length === 0 || !required.includes(user.role)) {
      throw new ForbiddenException(
        'Your role does not have access to this resource',
      );
    }
    return true;
  }
}
