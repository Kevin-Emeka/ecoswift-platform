import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResult } from '@ecoswift/types';

export class CustomerSummaryDto {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerNumber!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'DEACTIVATED'] })
  status!: string;

  @ApiProperty({ enum: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'] })
  tier!: string;

  @ApiProperty()
  accountCount!: number;

  @ApiProperty()
  dateJoined!: string;
}

export class AccountSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerNumber!: string;

  @ApiProperty()
  accountTypeCode!: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty({ enum: ['PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED', 'RESTRICTED'] })
  status!: string;

  @ApiProperty()
  availableBalance!: string;

  @ApiProperty()
  openedAt!: string;
}

export type PaginatedCustomerSummary = PaginatedResult<CustomerSummaryDto>;
export type PaginatedAccountSummary = PaginatedResult<AccountSummaryDto>;
