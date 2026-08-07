import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveTransferDto {
  @ApiPropertyOptional({ description: "Checker's note, stored alongside the approval decision." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}

export class RejectTransferDto {
  @ApiProperty({ description: 'Why this transfer is being declined — shown to the customer in their notification email.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export type TransferReviewStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

export class ListTransferReviewsQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: TransferReviewStatusFilter;
}

export class FraudSignalDto {
  @ApiProperty()
  signalType!: string;

  @ApiProperty()
  score!: number;

  @ApiPropertyOptional()
  reason?: string;
}

export class TransferReviewListItemDto {
  @ApiProperty({ description: 'The held Transaction id.' })
  id!: string;

  @ApiProperty()
  transactionReference!: string;

  @ApiProperty({ enum: ['INTERNAL', 'EXTERNAL_ACH', 'EXTERNAL_RTGS', 'EXTERNAL_SWIFT', 'WALLET'] })
  transferChannel!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty()
  sourceAccountNumber!: string;

  @ApiProperty({ description: 'Destination account number (internal) or "Beneficiary name (account number)" (external).' })
  destinationLabel!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  customerEmail!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  approvalStatus!: string;

  @ApiPropertyOptional()
  checkerName?: string;

  @ApiPropertyOptional()
  comments?: string;

  @ApiProperty()
  heldAt!: string;

  @ApiPropertyOptional()
  resolvedAt?: string;
}

export class TransferReviewDetailDto extends TransferReviewListItemDto {
  @ApiProperty({ type: [FraudSignalDto] })
  fraudSignals!: FraudSignalDto[];
}
