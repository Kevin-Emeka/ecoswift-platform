import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString } from 'class-validator';

export enum ConsentTypeDto {
  TERMS_AND_CONDITIONS = 'TERMS_AND_CONDITIONS',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  MARKETING_COMMUNICATIONS = 'MARKETING_COMMUNICATIONS',
}

export class RecordConsentDto {
  @ApiProperty({ enum: ConsentTypeDto })
  @IsEnum(ConsentTypeDto)
  consentType!: ConsentTypeDto;

  @ApiProperty({ example: '2026-01-01', description: 'The version of the document being accepted (or a constant, e.g. "1.0", for MARKETING_COMMUNICATIONS)' })
  @IsString()
  version!: string;

  @ApiProperty({ example: true, description: 'true to accept/opt in, false to withdraw/opt out — always a new row, never an update' })
  @IsBoolean()
  accepted!: boolean;
}
