import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] })
  channel!: string;

  @ApiProperty({ enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] })
  priority!: string;

  @ApiProperty({ enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SUPPRESSED'] })
  status!: string;

  @ApiPropertyOptional()
  subject?: string;

  @ApiPropertyOptional()
  body?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  readAt?: string;
}
