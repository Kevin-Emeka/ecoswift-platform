import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const SCOPES = ['GLOBAL', 'CUSTOMER', 'STAFF', 'PRODUCT'] as const;

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'loans.instant_approval' })
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z][a-z0-9_.]*$/, { message: 'key must be lowercase, dot/underscore separated' })
  key!: string;

  @ApiProperty({ example: 'Instant loan approval' })
  @IsString()
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: SCOPES, default: 'GLOBAL' })
  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number];

  @ApiPropertyOptional({ description: 'A specific customer/staff/product id the scope narrows to' })
  @IsOptional()
  @IsString()
  scopeReference?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SCOPES })
  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeReference?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;
}

export class ToggleFeatureFlagDto {
  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;
}
