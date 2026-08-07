import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, ValidateIf } from 'class-validator';

export type ScheduledTransferType = 'INTERNAL' | 'EXTERNAL';

export class CreateScheduledTransferDto {
  @ApiProperty({ enum: ['INTERNAL', 'EXTERNAL'] })
  @IsIn(['INTERNAL', 'EXTERNAL'])
  transferType!: ScheduledTransferType;

  @ApiPropertyOptional({ description: 'Required when transferType is INTERNAL — another account the caller owns.' })
  @ValidateIf((o) => o.transferType === 'INTERNAL')
  @IsUUID()
  destinationAccountId?: string;

  @ApiPropertyOptional({ description: 'Required when transferType is EXTERNAL — a verified beneficiary the caller owns.' })
  @ValidateIf((o) => o.transferType === 'EXTERNAL')
  @IsUUID()
  beneficiaryId?: string;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Rent' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ enum: ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY'] })
  @IsEnum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY'])
  frequency!: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @ApiProperty({ description: 'When the first (or only) occurrence should run. Must be in the future.' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ description: 'Last date a recurring series may run on. Ignored for ONE_TIME.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ScheduledTransferResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sourceAccountId!: string;

  @ApiProperty({ enum: ['INTERNAL', 'EXTERNAL'] })
  transferType!: ScheduledTransferType;

  @ApiPropertyOptional()
  destinationAccountId?: string;

  @ApiPropertyOptional()
  beneficiaryId?: string;

  @ApiPropertyOptional()
  beneficiaryName?: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY'] })
  frequency!: string;

  @ApiProperty()
  nextRunAt!: string;

  @ApiPropertyOptional()
  endDate?: string;

  @ApiProperty({ enum: ['SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'] })
  status!: string;

  @ApiPropertyOptional()
  lastRunAt?: string;

  @ApiPropertyOptional()
  failureReason?: string;

  @ApiProperty()
  createdAt!: string;
}
