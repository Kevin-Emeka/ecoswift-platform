import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';

export class RequestStatementDto {
  @ApiProperty({ description: 'Inclusive start of the statement period (date only).' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'Inclusive end of the statement period (date only).' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ enum: ['PDF', 'CSV'] })
  @IsIn(['PDF', 'CSV'])
  format!: 'PDF' | 'CSV';
}

export class StatementRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  accountId!: string;

  @ApiProperty()
  periodStart!: string;

  @ApiProperty()
  periodEnd!: string;

  @ApiProperty({ enum: ['PDF', 'CSV'] })
  format!: string;

  @ApiProperty({ enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] })
  status!: string;

  @ApiPropertyOptional()
  statementId?: string;

  @ApiPropertyOptional()
  completedAt?: string;

  @ApiProperty()
  createdAt!: string;
}
