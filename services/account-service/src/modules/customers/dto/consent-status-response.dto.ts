import { ApiProperty } from '@nestjs/swagger';

export class ConsentStatusResponseDto {
  @ApiProperty({ enum: ['TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'MARKETING_COMMUNICATIONS'] })
  consentType!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  accepted!: boolean;

  @ApiProperty()
  acceptedAt!: string;
}
