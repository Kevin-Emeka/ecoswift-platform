import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  deviceName?: string;

  @ApiPropertyOptional()
  platform?: string;

  @ApiProperty({ enum: ['UNTRUSTED', 'TRUSTED'] })
  trustLevel!: string;

  @ApiProperty()
  lastSeenAt!: Date;

  @ApiPropertyOptional()
  trustedAt?: Date;

  @ApiPropertyOptional({ description: 'Phase 3C device risk metadata — last IP observed for this device' })
  lastIpAddress?: string;

  @ApiPropertyOptional({ description: 'Phase 3C fraud-hook output at registration time (0–1); always 0 until a real fraud-hook implementation replaces the no-op default' })
  riskScore?: number;

  @ApiPropertyOptional()
  revokedAt?: Date;

  @ApiPropertyOptional()
  revokedReason?: string;
}
