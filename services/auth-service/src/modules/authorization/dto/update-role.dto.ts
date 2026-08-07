import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Set to null to detach from the current parent' })
  @IsOptional()
  @IsUUID()
  parentRoleId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}
