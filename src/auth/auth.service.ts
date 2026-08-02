import { ConflictException, Injectable } from '@nestjs/common';
import { User } from '@prisma-client';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { AuthTokensDto, AuthUserDto } from './dto/auth-response.dto';

export interface RequestContext {
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
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
