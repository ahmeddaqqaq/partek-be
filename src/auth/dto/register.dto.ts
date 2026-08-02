import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { Language, UserRole } from '@prisma-client';

export class RegisterDto {
  @ApiProperty({ example: 'buyer@fleet.sa' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'correct-horse-battery', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+9665\d{8}$/, {
    message: 'phone must be a Saudi mobile number in +9665XXXXXXXX format',
  })
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.client })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ enum: Language, default: Language.en })
  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;
}
