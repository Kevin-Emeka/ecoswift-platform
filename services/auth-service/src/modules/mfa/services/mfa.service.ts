import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { EncryptionService, TotpService } from '@ecoswift/security';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, MFA_ENROLLED, MFA_DISABLED, MFA_CHALLENGE_SUCCEEDED, MFA_CHALLENGE_FAILED } from '@ecoswift/event-bus';
import { BackupCodeService } from './backup-code.service';
import { OtpService } from '../../auth/services/otp.service';
import { AuthNotificationService } from '../../auth/services/auth-notification.service';
import { SecurityEventService } from '../../security/services/security-event.service';

export type MfaMethod = 'TOTP' | 'SMS' | 'EMAIL';
export type MfaVerificationMethod = MfaMethod | 'BACKUP_CODE';

export interface MfaFactorView {
  method: MfaMethod;
  isEnabled: boolean;
  enrolledAt: Date;
  disabledAt: Date | null;
  backupCodesRemaining?: number;
}

/**
 * Orchestrates MFA enrollment, confirmation, disable, and login-time
 * verification across all three factor types (docs/mfa.md). Domain
 * services (`TotpService`, `BackupCodeService`, `OtpService`) each own one
 * concern and know nothing about login flow; this is the only place that
 * sequences them, mirroring how `AuthService` sits over `PasswordService`/
 * `TokenService`/`SessionService` in Phase 3A.
 *
 * Backup codes are scoped to the **TOTP** factor specifically (they live on
 * `TwoFactorCredential.backupCodes`, and `TOTP` — an offline authenticator
 * app — is the factor a lost/wiped device can actually strand someone
 * behind; losing access to a verified email or phone is a different,
 * harder recovery problem backup codes don't solve either way). Enrolling
 * TOTP requires no pre-existing verified factor; enrolling SMS/EMAIL as an
 * *additional* factor uses the phone/email already on the account
 * (`authentication.md`'s email/phone verification), re-confirmed here
 * specifically as something the user can receive *right now*, not just
 * historically verified.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totpService: TotpService,
    private readonly backupCodeService: BackupCodeService,
    private readonly encryptionService: EncryptionService,
    private readonly otpService: OtpService,
    private readonly notificationService: AuthNotificationService,
    private readonly securityEvents: SecurityEventService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async getEnrolledFactors(userId: string): Promise<MfaFactorView[]> {
    const credentials = await this.prisma.twoFactorCredential.findMany({ where: { userId } });
    return Promise.all(
      credentials.map(async (credential) => ({
        method: credential.method as MfaMethod,
        isEnabled: credential.isEnabled,
        enrolledAt: credential.enrolledAt,
        disabledAt: credential.disabledAt,
        backupCodesRemaining:
          credential.method === 'TOTP' && credential.isEnabled
            ? await this.backupCodeService.remainingCount(credential.id)
            : undefined,
      })),
    );
  }

  async hasMfaEnabled(userId: string): Promise<MfaMethod[]> {
    const credentials = await this.prisma.twoFactorCredential.findMany({
      where: { userId, isEnabled: true },
      select: { method: true },
    });
    return credentials.map((c) => c.method as MfaMethod);
  }

  // -------------------------------------------------------------------
  // TOTP
  // -------------------------------------------------------------------

  async enrollTotp(userId: string, email: string): Promise<{ credentialId: string; secret: string; provisioningUri: string }> {
    const existing = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method: 'TOTP' } } });
    if (existing?.isEnabled) {
      throw new ConflictException('TOTP is already enabled for this account — disable it before re-enrolling');
    }

    const secret = this.totpService.generateSecret();
    const secretEncrypted = this.encryptionService.encrypt(secret);
    const provisioningUri = this.totpService.buildProvisioningUri(secret, email);

    const credential = await this.prisma.twoFactorCredential.upsert({
      where: { userId_method: { userId, method: 'TOTP' } },
      update: { secretEncrypted, isEnabled: false, disabledAt: null },
      create: { userId, method: 'TOTP', secretEncrypted, isEnabled: false },
    });

    return { credentialId: credential.id, secret, provisioningUri };
  }

  async confirmTotp(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const credential = await this.getPendingCredential(userId, 'TOTP');
    const secret = this.encryptionService.decrypt(credential.secretEncrypted!);

    if (!this.totpService.verify(secret, code)) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.twoFactorCredential.update({
      where: { id: credential.id },
      data: { isEnabled: true, enrolledAt: new Date(), disabledAt: null },
    });

    await this.backupCodeService.invalidateAll(credential.id);
    const backupCodes = await this.backupCodeService.generate(credential.id);

    await this.securityEvents.record({ userId, eventType: 'TWO_FA_ENABLED', metadata: { method: 'TOTP' } });
    await this.eventPublisher.publish({
      eventType: MFA_ENROLLED,
      producerContext: 'auth-service',
      payload: { userId, method: 'TOTP' },
    });

    return { backupCodes };
  }

  // -------------------------------------------------------------------
  // SMS / Email (as an MFA factor — separate from login-time challenge delivery below)
  // -------------------------------------------------------------------

  async enrollContactFactor(userId: string, method: 'SMS' | 'EMAIL'): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (method === 'SMS' && !user.phone) {
      throw new BadRequestException('Add and verify a phone number before enrolling SMS as an MFA factor');
    }

    await this.prisma.twoFactorCredential.upsert({
      where: { userId_method: { userId, method } },
      update: { isEnabled: false, disabledAt: null },
      create: { userId, method, isEnabled: false },
    });

    const code = await this.otpService.generateNumericCode(userId, 'TWO_FACTOR_ENROLLMENT');
    if (method === 'SMS') {
      await this.notificationService.sendSms({
        userId,
        toNumber: user.phone!,
        templateCode: 'OTP_CHALLENGE',
        variables: { code, expiryMinutes: '5' },
      });
    } else {
      await this.notificationService.sendEmail({
        userId,
        toAddress: user.email,
        templateCode: 'OTP_CHALLENGE_EMAIL',
        variables: { code, expiryMinutes: '5' },
      });
    }

    return { message: `A verification code has been sent to confirm ${method === 'SMS' ? 'SMS' : 'email'} as a sign-in factor.` };
  }

  async confirmContactFactor(userId: string, method: 'SMS' | 'EMAIL', code: string): Promise<{ message: string }> {
    await this.getPendingCredential(userId, method);
    await this.otpService.verifyOwnedCode(userId, 'TWO_FACTOR_ENROLLMENT', code);

    await this.prisma.twoFactorCredential.update({
      where: { userId_method: { userId, method } },
      data: { isEnabled: true, enrolledAt: new Date(), disabledAt: null },
    });

    await this.securityEvents.record({ userId, eventType: 'TWO_FA_ENABLED', metadata: { method } });
    await this.eventPublisher.publish({ eventType: MFA_ENROLLED, producerContext: 'auth-service', payload: { userId, method } });

    return { message: `${method === 'SMS' ? 'SMS' : 'Email'} sign-in verification enabled.` };
  }

  // -------------------------------------------------------------------
  // Disable / backup codes
  // -------------------------------------------------------------------

  async disableFactor(userId: string, method: MfaMethod): Promise<void> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method } } });
    if (!credential || !credential.isEnabled) {
      throw new NotFoundException(`${method} is not currently enabled for this account`);
    }

    await this.prisma.twoFactorCredential.update({
      where: { id: credential.id },
      data: { isEnabled: false, disabledAt: new Date() },
    });
    if (method === 'TOTP') {
      await this.backupCodeService.invalidateAll(credential.id);
    }

    await this.securityEvents.record({ userId, eventType: 'TWO_FA_DISABLED', metadata: { method } });
    await this.eventPublisher.publish({ eventType: MFA_DISABLED, producerContext: 'auth-service', payload: { userId, method } });
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method: 'TOTP' } } });
    if (!credential || !credential.isEnabled) {
      throw new BadRequestException('Enable TOTP before generating backup codes');
    }

    await this.backupCodeService.invalidateAll(credential.id);
    const codes = await this.backupCodeService.generate(credential.id);

    await this.securityEvents.record({ userId, eventType: 'BACKUP_CODES_REGENERATED' });
    return codes;
  }

  // -------------------------------------------------------------------
  // Login-time challenge delivery + verification
  // -------------------------------------------------------------------

  /** Sends a fresh OTP for an SMS/EMAIL factor at login time — TOTP needs no send step (the code already lives in the user's authenticator app). */
  async sendLoginChallenge(userId: string, method: 'SMS' | 'EMAIL'): Promise<void> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method } } });
    if (!credential?.isEnabled) {
      throw new BadRequestException(`${method} is not an enabled sign-in factor for this account`);
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const code = await this.otpService.generateNumericCode(userId, 'LOGIN');

    if (method === 'SMS') {
      await this.notificationService.sendSms({ userId, toNumber: user.phone!, templateCode: 'OTP_CHALLENGE', variables: { code, expiryMinutes: '5' } });
    } else {
      await this.notificationService.sendEmail({ userId, toAddress: user.email, templateCode: 'OTP_CHALLENGE_EMAIL', variables: { code, expiryMinutes: '5' } });
    }
  }

  /** Verifies whichever factor the caller presents. Throws on failure — callers (login, step-up) handle failed-attempt bookkeeping themselves, since the two flows track failures differently (login lockout vs. step-up has none). */
  async verifyFactor(userId: string, method: MfaVerificationMethod, code: string): Promise<void> {
    const success = await this.attemptVerify(userId, method, code);

    await this.securityEvents.record({
      userId,
      eventType: success ? 'TWO_FA_CHALLENGE_SUCCEEDED' : 'TWO_FA_CHALLENGE_FAILED',
      metadata: { method },
    });
    await this.eventPublisher.publish({
      eventType: success ? MFA_CHALLENGE_SUCCEEDED : MFA_CHALLENGE_FAILED,
      producerContext: 'auth-service',
      payload: { userId, method },
    });

    if (!success) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (method === 'BACKUP_CODE') {
      await this.securityEvents.record({ userId, eventType: 'BACKUP_CODE_USED' });
    }
  }

  private async attemptVerify(userId: string, method: MfaVerificationMethod, code: string): Promise<boolean> {
    if (method === 'TOTP') {
      const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method: 'TOTP' } } });
      if (!credential?.isEnabled || !credential.secretEncrypted) return false;
      return this.totpService.verify(this.encryptionService.decrypt(credential.secretEncrypted), code);
    }

    if (method === 'BACKUP_CODE') {
      const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method: 'TOTP' } } });
      if (!credential?.isEnabled) return false;
      return this.backupCodeService.consume(credential.id, code);
    }

    // SMS / EMAIL — verified against the same OtpChallenge the login-time send created.
    try {
      await this.otpService.verifyOwnedCode(userId, 'LOGIN', code);
      return true;
    } catch {
      return false;
    }
  }

  private async getPendingCredential(userId: string, method: MfaMethod) {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method } } });
    if (!credential) {
      throw new NotFoundException(`No pending ${method} enrollment found — start enrollment first`);
    }
    if (credential.isEnabled) {
      throw new ConflictException(`${method} is already enabled`);
    }
    return credential;
  }
}
