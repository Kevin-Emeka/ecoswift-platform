import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'FREEZE', 'UNFREEZE', 'EXPORT', 'VIEW'] as const;

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 25, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Filter to a specific resource type, e.g. "Account", "Customer", "Role"' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ enum: ACTION_TYPES })
  @IsOptional()
  @IsIn(ACTION_TYPES)
  actionType?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — only entries at or after this time' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — only entries at or before this time' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
