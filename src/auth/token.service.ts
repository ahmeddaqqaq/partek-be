import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { User, UserStatus } from '@prisma-client';
import { AuthRepository } from './auth.repository';
import { TokenRepository } from './token.repository';
import { JwtPayload } from './jwt.strategy';

export const JWT_CONFIG = 'JWT_CONFIG';

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenContext {
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly tokens: TokenRepository,
    private readonly users: AuthRepository,
    @Inject(JWT_CONFIG) private readonly config: JwtConfig,
  ) {}

  async issue(user: User, ctx: TokenContext): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      // `expiresIn` is typed as the `ms` template literal ("15m", "7d", ...),
      // but this value arrives from an environment variable and is therefore
      // an arbitrary string until validated. A malformed value fails loudly
      // inside jsonwebtoken at sign time.
      expiresIn: this.config.accessExpiresIn as JwtSignOptions['expiresIn'],
    });

    // The refresh token is opaque, not a JWT. It carries no claims, so it
    // cannot be read or replayed for information, and revocation is a
    // single indexed row lookup.
    const refreshToken = randomBytes(32).toString('hex');

    await this.tokens.create({
      userId: user.id,
      tokenHash: this.hash(refreshToken),
      expiresAt: this.refreshExpiry(),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return { accessToken, refreshToken };
  }

  async rotate(
    refreshToken: string,
    ctx: TokenContext,
  ): Promise<TokenPair & { user: User }> {
    const record = await this.tokens.findActiveByHash(this.hash(refreshToken));
    if (!record) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findUserById(record.userId);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Single use: the presented token is revoked whether or not issuing the
    // replacement succeeds.
    await this.tokens.revokeById(record.id);
    const pair = await this.issue(user, ctx);
    return { ...pair, user };
  }

  async revoke(refreshToken: string): Promise<void> {
    const record = await this.tokens.findActiveByHash(this.hash(refreshToken));
    if (!record) return;
    await this.tokens.revokeById(record.id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry(): Date {
    const match = /^(\d+)([smhd])$/.exec(this.config.refreshExpiresIn);
    if (!match) {
      throw new Error(
        `JWT_REFRESH_EXPIRES_IN must look like "7d" or "30m" (got "${this.config.refreshExpiresIn}")`,
      );
    }
    const amount = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      match[2] as 's' | 'm' | 'h' | 'd'
    ];
    return new Date(Date.now() + amount * unitMs);
  }
}
