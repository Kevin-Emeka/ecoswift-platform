import { createHash, randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { AccountNotificationService } from '../../../common/services/account-notification.service';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const PURPOSE = 'TRANSACTION_CONFIRMATION';

/**
 * Mandatory email OTP for every international wire transfer — replaces the
 * old risk-based conditional step-up (TOTP-if-enrolled, else hold for staff
 * review) for this transfer type specifically. Every wire now requires a
 * code, full stop; no held-for-review fallback. Reuses the existing
 * `OtpChallenge` table/`TRANSACTION_CONFIRMATION` purpose (shared schema,
 * already modeled for exactly this) rather than adding a new table —
 * account-service hashes/verifies its own challenges independently of
 * auth-service's `OtpService`, since they're separate deployables that
 * only share the database, not runtime code.
 */
@Injectable()
export class TransferOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: AccountNotificationService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /** Issues a fresh 6-digit code, invalidating any previous pending one for this user, and emails it. */
  async sendCode(
    userId: string,
    customerId: string,
    toAddress: string,
    firstName: string,
  ): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.prisma.otpChallenge.updateMany({
      where: { userId, purpose: PURPOSE, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    await this.prisma.otpChallenge.create({
      data: {
        userId,
        purpose: PURPOSE,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        maxAttempts: OTP_MAX_ATTEMPTS,
      },
    });

    // Reuses the existing generic OTP_CHALLENGE_EMAIL template (already
    // shaped for exactly this: {{code}}, {{expiryMinutes}}) rather than
    // adding a transfer-specific one.
    await this.notificationService.sendEmail({
      customerId,
      toAddress,
      templateCode: 'OTP_CHALLENGE_EMAIL',
      variables: {
        firstName,
        code,
        expiryMinutes: String(OTP_TTL_MINUTES),
      },
    });
  }

  /** Verifies `code` against the current pending challenge for this user. Throws on any failure (no active challenge, expired, exhausted, mismatch). */
  async verifyCode(userId: string, code: string): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { userId, purpose: PURPOSE, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException(
        'No active verification code found for this transfer — please try again',
      );
    }
    if (challenge.expiresAt < new Date()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Verification code has expired — please try again');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Too many incorrect attempts — please try again');
    }
    if (this.hash(code) !== challenge.codeHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
  }
}
