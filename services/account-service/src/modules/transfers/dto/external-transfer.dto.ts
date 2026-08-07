import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength, Min } from 'class-validator';

/**
 * Full recipient + beneficiary-bank detail, captured inline on the
 * transfer form itself — no pre-saved, separately-verified `Beneficiary`
 * is required before sending (see `ExternalTransferService`'s doc
 * comment). `BeneficiariesService.findOrCreateForWire` persists these
 * details behind the scenes so the recipient still shows up on the
 * Beneficiaries page afterwards for reuse, but that's a side effect, not
 * a prerequisite.
 */
export class ExternalTransferDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Full name of the beneficiary' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  beneficiaryName!: string;

  @ApiProperty({ example: 'GB29NWBK60161331926819', description: 'Beneficiary account number or IBAN' })
  @IsString()
  @MinLength(4)
  @MaxLength(34)
  accountNumber!: string;

  @ApiProperty({ example: 'National Westminster Bank', description: 'Beneficiary bank name' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  bankName!: string;

  @ApiProperty({ example: 'NWBKGB2L', description: 'SWIFT/BIC code of the beneficiary bank' })
  @IsString()
  @MinLength(8)
  @MaxLength(11)
  swiftBic!: string;

  @ApiProperty({ example: '250 Bishopsgate, London EC2M 4AA, United Kingdom', description: 'Beneficiary bank address' })
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  bankAddress!: string;

  @ApiProperty({ example: 'GB', description: 'ISO 3166-1 alpha-2 country code of the beneficiary bank' })
  @Matches(/^[A-Z]{2}$/, { message: 'bankCountryCode must be a 2-letter ISO country code' })
  bankCountryCode!: string;

  @ApiPropertyOptional({
    example: '021000021',
    description: 'ABA routing number / sort code — only needed for some corridors (e.g. a USD wire\'s domestic leg)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  routingNumber?: string;

  @ApiProperty({ example: 'GBP', description: 'ISO 4217 currency code — must match the source account currency' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currencyCode!: string;

  @ApiProperty({ example: 250, description: 'Simulated settlement only — see ExternalTransferService. Must be > 0.' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Invoice #4521', description: 'Purpose of payment' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: '6-digit TOTP code — only required if the initial attempt is rejected with MFA_REQUIRED.' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'mfaCode must be a 6-digit code' })
  mfaCode?: string;
}
