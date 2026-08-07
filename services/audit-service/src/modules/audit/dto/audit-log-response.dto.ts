import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  actorUserId?: string;

  @ApiPropertyOptional()
  actorEmail?: string;

  @ApiPropertyOptional({ enum: ['CUSTOMER', 'STAFF', 'SYSTEM'] })
  actorType?: string;

  @ApiProperty()
  actionType!: string;

  @ApiProperty()
  resourceType!: string;

  @ApiPropertyOptional()
  resourceId?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  beforeState?: unknown;

  @ApiPropertyOptional()
  afterState?: unknown;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiProperty({ description: 'SHA-256 hash of this entry chained to the previous entry — tamper-evidence, see docs/compliance-controls.md' })
  integrityHash!: string;

  @ApiPropertyOptional()
  previousHash?: string;

  @ApiProperty()
  createdAt!: string;
}
