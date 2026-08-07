import { ApiProperty } from '@nestjs/swagger';

/**
 * Returned from `POST /v1/auth/login` in place of `AuthResponseDto` when
 * the account has at least one enabled MFA factor — password verification
 * succeeded, but no session/tokens exist yet. The client's next call is
 * `POST /v1/auth/mfa/challenge` (SMS/EMAIL only) or straight to
 * `POST /v1/auth/mfa/verify` (TOTP/BACKUP_CODE need no send step) with
 * this `mfaToken`. See docs/mfa.md § Login Flow.
 */
export class MfaChallengeResponseDto {
  @ApiProperty({ example: true })
  mfaRequired!: true;

  @ApiProperty({ description: 'Short-lived — redeemable only at /v1/auth/mfa/challenge and /v1/auth/mfa/verify' })
  mfaToken!: string;

  @ApiProperty({ enum: ['TOTP', 'SMS', 'EMAIL'], isArray: true })
  availableMethods!: ('TOTP' | 'SMS' | 'EMAIL')[];
}
