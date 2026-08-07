import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerProfileResponseDto {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerNumber!: string;

  @ApiProperty({ enum: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'] })
  tier!: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'DEACTIVATED'] })
  status!: string;

  @ApiProperty()
  firstName!: string;

  @ApiPropertyOptional()
  middleName?: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  dateOfBirth!: string;

  @ApiPropertyOptional()
  gender?: string;

  @ApiPropertyOptional()
  addressLine1?: string;

  @ApiPropertyOptional()
  addressLine2?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  state?: string;

  @ApiPropertyOptional()
  postalCode?: string;

  @ApiPropertyOptional()
  addressCountryCode?: string;

  @ApiPropertyOptional()
  occupation?: string;

  @ApiProperty()
  preferredLanguage!: string;

  @ApiPropertyOptional()
  preferredCurrencyCode?: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ enum: ['INCOMPLETE', 'COMPLETE'] })
  profileCompletionStatus!: string;

  @ApiProperty()
  missingFields!: string[];
}
