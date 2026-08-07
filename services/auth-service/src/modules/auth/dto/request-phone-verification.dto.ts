import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class RequestPhoneVerificationDto {
  @ApiProperty({ example: '+15551234567', description: 'E.164 format' })
  @IsPhoneNumber(undefined)
  phone!: string;
}
