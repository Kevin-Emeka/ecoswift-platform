import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ipAddress!: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiPropertyOptional()
  deviceName?: string;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ description: 'True for the session making this request.' })
  isCurrent!: boolean;
}
