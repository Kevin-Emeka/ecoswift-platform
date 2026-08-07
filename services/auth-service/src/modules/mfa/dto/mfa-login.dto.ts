import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsJWT, IsString, Length } from 'class-validator';

const VERIFICATION_METHODS = ['TOTP', 'SMS', 'EMAIL', 'BACKUP_CODE'] as const;
const CHALLENGE_METHODS = ['SMS', 'EMAIL'] as const;

export class MfaLoginChallengeRequestDto {
  @ApiProperty({ description: 'The mfaToken returned from /v1/auth/login' })
  @IsJWT()
  mfaToken!: string;

  @ApiProperty({ enum: CHALLENGE_METHODS, description: 'TOTP needs no send step — only SMS/EMAIL do' })
  @IsIn(CHALLENGE_METHODS)
  method!: (typeof CHALLENGE_METHODS)[number];
}

export class MfaLoginVerifyDto {
  @ApiProperty({ description: 'The mfaToken returned from /v1/auth/login' })
  @IsJWT()
  mfaToken!: string;

  @ApiProperty({ enum: VERIFICATION_METHODS })
  @IsIn(VERIFICATION_METHODS)
  method!: (typeof VERIFICATION_METHODS)[number];

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 10)
  code!: string;
}
