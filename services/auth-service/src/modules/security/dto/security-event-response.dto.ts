import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SecurityEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  userEmail?: string;

  @ApiProperty()
  eventType!: string;

  @ApiPropertyOptional()
  deviceId?: string;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  riskScore?: string;

  @ApiPropertyOptional()
  metadata?: unknown;

  @ApiProperty()
  createdAt!: string;
}
