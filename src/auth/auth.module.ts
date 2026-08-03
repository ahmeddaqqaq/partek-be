import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfig } from '@/config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { TokenRepository } from './token.repository';
import { TokenService, JWT_CONFIG } from './token.service';
import { PasswordService, BCRYPT_ROUNDS } from './password.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    TokenRepository,
    TokenService,
    PasswordService,
    JwtStrategy,
    {
      provide: BCRYPT_ROUNDS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        config.get('bcryptRounds', { infer: true }),
    },
    {
      provide: JWT_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        config.get('jwt', { infer: true }),
    },
  ],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
