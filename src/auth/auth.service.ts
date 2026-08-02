import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserStatus } from '@prisma-client';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokensDto, AuthUserDto } from './dto/auth-response.dto';

export interface RequestContext {
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private static readonly INVALID_CREDENTIALS = 'Invalid email or password';

  /** A real bcrypt hash of a random string, used to level timing on unknown emails. */
  private static readonly DUMMY_HASH =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEe.CFPqZ8jVJ9c1r1YkYlZ1qJ8k1Yq7yzO';

  constructor(
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(
    dto: RegisterDto,
    ctx: RequestContext,
  ): Promise<AuthTokensDto> {
    const existing = await this.repo.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.repo.createUser({
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      phone: dto.phone,
      role: dto.role,
      preferredLanguage: dto.preferredLanguage,
    });

    const pair = await this.tokens.issue(user, ctx);
    return { ...pair, user: this.toAuthUser(user) };
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokensDto> {
    const user = await this.repo.findUserByEmail(dto.email);

    // Always run a comparison, even with no user, so response time does not
    // distinguish "unknown email" from "wrong password".
    const passwordMatches = await this.passwords.compare(
      dto.password,
      user?.passwordHash ?? AuthService.DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(AuthService.INVALID_CREDENTIALS);
    }
    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException(AuthService.INVALID_CREDENTIALS);
    }

    await this.repo.touchLastLogin(user.id);
    const pair = await this.tokens.issue(user, ctx);
    return { ...pair, user: this.toAuthUser(user) };
  }

  protected toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
    };
  }
}
