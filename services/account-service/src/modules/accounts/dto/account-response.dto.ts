import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  accountTypeCode!: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty({ enum: ['PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED', 'RESTRICTED'] })
  status!: string;

  @ApiProperty()
  availableBalance!: string;

  @ApiProperty()
  currentBalance!: string;

  @ApiProperty()
  openedAt!: string;

  @ApiPropertyOptional()
  closedAt?: string;

  @ApiPropertyOptional({ description: 'The journal entry number for the opening funding, if the account was opened with a non-zero balance' })
  openingJournalNumber?: string;
}
