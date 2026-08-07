import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

const VERIFICATION_METHODS = ['TOTP', 'SMS', 'EMAIL', 'BACKUP_CODE'] as const;

export class StepUpDto {
  @ApiProperty({ enum: VERIFICATION_METHODS })
  @IsIn(VERIFICATION_METHODS)
  method!: (typeof VERIFICATION_METHODS)[number];

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 10)
  code!: string;
}
