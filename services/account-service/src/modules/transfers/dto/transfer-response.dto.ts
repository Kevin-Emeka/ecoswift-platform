import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  transactionReference!: string;

  @ApiProperty({ example: 'TRANSFER_INTERNAL' })
  transferType!: string;

  @ApiPropertyOptional()
  sourceAccountId?: string;

  @ApiPropertyOptional()
  destinationAccountId?: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty({ enum: ['INITIATED', 'PENDING', 'VALIDATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'] })
  status!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ description: 'True for external transfers — simulated settlement, no real payment rail is connected. False for internal transfers, which post real balanced ledger entries within this platform.' })
  sandbox!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  completedAt?: string;
}
