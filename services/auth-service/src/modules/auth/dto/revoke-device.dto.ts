import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeDeviceDto {
  @ApiPropertyOptional({ example: 'I don\'t recognize this device' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
