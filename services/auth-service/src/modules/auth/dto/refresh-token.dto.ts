import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Only required if the refresh token cookie is not present (e.g. non-browser clients).',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
