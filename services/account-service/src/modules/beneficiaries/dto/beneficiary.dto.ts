import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  beneficiaryName!: string;

  @ApiProperty({ example: '0123456789', description: 'Account number, or IBAN for an international wire' })
  @IsString()
  @MinLength(4)
  @MaxLength(34)
  accountNumber!: string;

  @ApiPropertyOptional({ example: 'Chase Bank' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @ApiPropertyOptional({ example: 'CHASUS33', deprecated: true, description: 'Prefer swiftBic for international wires' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankCode?: string;

  @ApiPropertyOptional({ example: 'CHASUS33', description: 'SWIFT/BIC code of the beneficiary bank — required for international wires' })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  swiftBic?: string;

  @ApiPropertyOptional({ example: '270 Park Avenue, New York, NY 10017', description: 'Beneficiary bank address' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  bankAddress?: string;

  @ApiPropertyOptional({ example: 'US', description: 'ISO 3166-1 alpha-2 country code of the beneficiary bank' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'bankCountryCode must be a 2-letter ISO country code' })
  bankCountryCode?: string;

  @ApiPropertyOptional({ example: '021000021', description: 'ABA routing number / sort code — only needed for some corridors (e.g. US domestic leg of a wire)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  routingNumber?: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currencyCode!: string;

  @ApiPropertyOptional({ example: 'Mom' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string;
}

export class UpdateBeneficiaryDto {
  @ApiPropertyOptional({ example: 'Mom' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class BeneficiaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  beneficiaryName!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiPropertyOptional()
  bankName?: string;

  @ApiPropertyOptional()
  bankCode?: string;

  @ApiPropertyOptional()
  swiftBic?: string;

  @ApiPropertyOptional()
  bankAddress?: string;

  @ApiPropertyOptional()
  bankCountryCode?: string;

  @ApiPropertyOptional()
  routingNumber?: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiPropertyOptional()
  nickname?: string;

  @ApiProperty()
  isFavorite!: boolean;

  @ApiProperty({ enum: ['PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED'] })
  status!: string;

  @ApiProperty()
  createdAt!: string;
}
