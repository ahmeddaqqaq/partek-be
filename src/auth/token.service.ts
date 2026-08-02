import { Injectable } from '@nestjs/common';
import { User } from '@prisma-client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Placeholder — the real implementation lands in Task 13.
 *
 * The brief specified an empty class here, but AuthService.register already
 * calls `issue()`, so an empty class does not typecheck. The signature is
 * declared now and the body throws: any caller reaching this before Task 13
 * fails loudly rather than silently returning undefined tokens.
 */
@Injectable()
export class TokenService {
  issue(
    _user: User,
    _ctx: { ipAddress: string; userAgent?: string },
  ): Promise<TokenPair> {
    throw new Error('TokenService.issue is implemented in Task 13');
  }
}
