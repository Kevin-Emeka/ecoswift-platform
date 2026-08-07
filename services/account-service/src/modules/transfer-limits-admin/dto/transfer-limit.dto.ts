import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsString, IsUUID, Length, Min, ValidateIf } from 'class-validator';

export type TransferLimitScope = 'GLOBAL' | 'TIER' | 'CUSTOMER' | 'ACCOUNT';
export type KycTierName = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';

const SCOPES: TransferLimitScope[] = ['GLOBAL', 'TIER', 'CUSTOMER', 'ACCOUNT'];
const TIERS: KycTierName[] = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];

export class CreateTransferLimitDto {
  @ApiProperty({ enum: SCOPES, description: 'Which resolution tier this limit applies at — see TransferLimitsService for the account > customer > tier > global precedence.' })
  @IsIn(SCOPES)
  scope!: TransferLimitScope;

  @ApiPropertyOptional({ enum: TIERS, description: 'Required when scope is TIER.' })
  @ValidateIf((o) => o.scope === 'TIER')
  @IsIn(TIERS)
  tier?: KycTierName;

  @ApiPropertyOptional({ description: 'Required when scope is CUSTOMER.' })
  @ValidateIf((o) => o.scope === 'CUSTOMER')
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Required when scope is ACCOUNT.' })
  @ValidateIf((o) => o.scope === 'ACCOUNT')
  @IsUUID()
  accountId?: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currencyCode!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  dailyLimit!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  perTransactionLimit!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  monthlyLimit!: number;
}

export class TransferLimitResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SCOPES })
  scope!: TransferLimitScope;

  @ApiPropertyOptional()
  tier?: string;

  @ApiPropertyOptional()
  customerId?: string;

  @ApiPropertyOptional()
  customerName?: string;

  @ApiPropertyOptional()
  accountId?: string;

  @ApiPropertyOptional()
  accountNumber?: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty()
  dailyLimit!: string;

  @ApiProperty()
  perTransactionLimit!: string;

  @ApiProperty()
  monthlyLimit!: string;

  @ApiProperty()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  effectiveTo?: string;
}
