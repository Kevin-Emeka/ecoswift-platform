import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] })
  channel!: string;

  @ApiPropertyOptional()
  subjectTemplate?: string;

  @ApiProperty()
  locale!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  updatedAt!: string;
}
