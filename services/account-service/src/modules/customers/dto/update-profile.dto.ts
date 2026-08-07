import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

/** Timezone is validated as a non-empty IANA-shaped string, not against a hardcoded list — the full tz database changes too often to vendor here. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '221B Baker Street' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Suite 4' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Lagos State' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '100001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'NG', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'addressCountryCode must be an uppercase ISO 3166-1 alpha-2 code' })
  addressCountryCode?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiPropertyOptional({ example: 'en', description: 'ISO 639-1 language code' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: '3f9a1b2c-...', description: 'Currency id (see the seeded Currency catalog)' })
  @IsOptional()
  @IsUUID()
  preferredCurrencyId?: string;

  @ApiPropertyOptional({ example: 'Africa/Lagos', description: 'IANA timezone name' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ example: 'M', description: 'Free-form; not validated against a fixed enum' })
  @IsOptional()
  @IsIn(['M', 'F', 'X', 'PREFER_NOT_TO_SAY'])
  gender?: string;
}
