import { randomBytes, randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { ConfigurationService } from '@ecoswift/config';
import { TokenService } from './token.service';
import { AUTH_DEFAULTS } from '../constants/auth.constants';

export type OtpPurpose =
  | 'LOGIN'
  | 'PASSWORD_RESET'
  | 'TRANSACTION_CONFIRMATION'
  | 'TWO_FACTOR_ENROLLMENT'
  | 'EMAIL_VERIFICATION'
  | 'PHONE_VERIFICATION';

export class OtpConflictError extends Error {}

/**
 * Generic one-time-proof issuance/verification over `OtpChallenge`
 * (security-model.md § OTP Lifecycle) — "one-time proof" covers both a
 * 6-digit SMS code (phone verification) and a long random link token (email
 * verification, password reset): same lifecycle (generate → expire →
 * bounded verification attempts → single use), different shape of the
 * secret itself.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configurationService: ConfigurationService,
  ) {}

  /** 6-digit numeric code — for SMS delivery (business-rules.md § Notification Triggers keeps SMS short). */
  async generateNumericCode(userId: string, purpose: OtpPurpose): Promise<string> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.persistChallenge(userId, purpose, code);
    return code;
  }

  /** Long, URL-safe random token — for email link delivery. */
  async generateLinkToken(userId: string, purpose: OtpPurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.persistChallenge(userId, purpose, token);
    return token;
  }

  private async persistChallenge(userId: string, purpose: OtpPurpose, secret: string): Promise<void> {
    const expiryMinutes = await this.expiryMinutesFor(purpose);

    // Only one live challenge per (user, purpose) at a time — issuing a new
    // one invalidates any previous one outright, rather than letting an
    // old, forgotten code/link stay valid alongside a fresh one.
    await this.prisma.otpChallenge.updateMany({
      where: { userId, purpose, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    await this.prisma.otpChallenge.create({
      data: {
        userId,
        purpose,
        codeHash: this.tokenService.hashToken(secret),
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
        maxAttempts: await this.configurationService.getNumber('otp.max_attempts', AUTH_DEFAULTS.otpMaxAttempts),
      },
    });
  }

  /**
   * Verifies `secret` against the current pending challenge for
   * `(userId, purpose)` — for challenges where the caller already knows
   * their own identity (phone verification: the user is authenticated when
   * they request and confirm a code). Throws `BadRequestException` on any
   * failure (expired, exhausted, no such challenge, mismatch) — the caller
   * never needs to distinguish these for the end user (business-rules.md:
   * a stale OTP "is simply invalid, not just less trusted").
   */
  async verifyOwnedCode(userId: string, purpose: OtpPurpose, secret: string): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { userId, purpose, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    await this.checkAndConsume(challenge, secret);
  }

  /**
   * Verifies a bearer link token (email verification, password reset)
   * **without** already knowing which user it belongs to — that's the
   * whole point of a link the recipient just clicks, they aren't
   * authenticated yet. Looks the challenge up by its hash directly (a
   * 32-byte random token collision is not a practical concern) and returns
   * the `userId` it resolves to on success.
   */
  async verifyLinkToken(purpose: OtpPurpose, secret: string): Promise<{ userId: string }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { purpose, status: 'PENDING', codeHash: this.tokenService.hashToken(secret) },
    });
    await this.checkAndConsume(challenge, secret);
    return { userId: challenge!.userId };
  }

  private async checkAndConsume(
    challenge: { id: string; expiresAt: Date; attempts: number; maxAttempts: number; codeHash: string } | null,
    secret: string,
  ): Promise<void> {
    if (!challenge) {
      throw new BadRequestException('No active verification request found');
    }

    if (challenge.expiresAt < new Date()) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Verification code has expired');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Too many attempts — request a new code');
    }

    const matches = this.tokenService.hashToken(secret) === challenge.codeHash;

    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
  }

  private async expiryMinutesFor(purpose: OtpPurpose): Promise<number> {
    switch (purpose) {
      case 'EMAIL_VERIFICATION':
        return this.configurationService.getNumber(
          'email_verification.expiry_minutes',
          AUTH_DEFAULTS.emailVerificationTtlMinutes,
        );
      case 'PASSWORD_RESET':
        return this.configurationService.getNumber(
          'password_reset.expiry_minutes',
          AUTH_DEFAULTS.passwordResetTtlMinutes,
        );
      default:
        return this.configurationService.getNumber('otp.expiry_minutes', AUTH_DEFAULTS.otpTtlMinutes);
    }
  }
}
