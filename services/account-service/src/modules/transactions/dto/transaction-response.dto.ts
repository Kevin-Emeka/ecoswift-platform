import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  transactionReference!: string;

  @ApiProperty({ example: 'DEPOSIT' })
  transactionType!: string;

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

  @ApiProperty({ description: 'True for simulated deposits/withdrawals (see SandboxTransactionService); false for transfers, which post real balanced ledger entries within this platform.' })
  sandbox!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  completedAt?: string;
}
