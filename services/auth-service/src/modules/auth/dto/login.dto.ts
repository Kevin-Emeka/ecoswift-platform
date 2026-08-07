import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Extends the refresh token / session lifetime from the standard TTL to the remember-me TTL (see ApplicationSetting refresh_token.remember_me_ttl_days).',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
