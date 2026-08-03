import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService, RequestContext } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthTokensDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account and receive a token pair' })
  @ApiResponse({ status: 201, type: AuthTokensDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    return this.auth.register(dto, this.context(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a token pair' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthTokensDto> {
    return this.auth.login(dto, this.context(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new pair' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthTokensDto> {
    return this.auth.refresh(dto.refreshToken, this.context(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiResponse({
    status: 204,
    description: 'Token revoked, or was already invalid',
  })
  logout(@Body() dto: RefreshDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  private context(req: Request): RequestContext {
    return {
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? undefined,
    };
  }
}
