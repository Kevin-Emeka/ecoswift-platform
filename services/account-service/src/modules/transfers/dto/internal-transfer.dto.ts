import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, Matches } from 'class-validator';

export class InternalTransferDto {
  @ApiProperty({ description: 'Another account the caller owns — must differ from the source account in the URL.' })
  @IsUUID()
  destinationAccountId!: string;

  @ApiProperty({ example: 100, description: 'Must be > 0 and within available balance / transfer limits.' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Moving savings' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: '6-digit TOTP code — only required if the initial attempt is rejected with MFA_REQUIRED.' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'mfaCode must be a 6-digit code' })
  mfaCode?: string;
}
