import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The opaque refresh token issued at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
