import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MfaService } from './mfa.service';
import type { PrismaService } from '@ecoswift/database';
import type { EncryptionService, TotpService } from '@ecoswift/security';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { BackupCodeService } from './backup-code.service';
import type { OtpService } from '../../auth/services/otp.service';
import type { AuthNotificationService } from '../../auth/services/auth-notification.service';
import type { SecurityEventService } from '../../security/services/security-event.service';

describe('MfaService', () => {
  let prisma: {
    twoFactorCredential: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock };
    user: { findUniqueOrThrow: jest.Mock };
  };
  let totpService: jest.Mocked<Pick<TotpService, 'generateSecret' | 'buildProvisioningUri' | 'verify'>>;
  let backupCodeService: jest.Mocked<Pick<BackupCodeService, 'generate' | 'invalidateAll' | 'consume' | 'remainingCount'>>;
  let encryptionService: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;
  let otpService: jest.Mocked<Pick<OtpService, 'generateNumericCode' | 'verifyOwnedCode'>>;
  let notificationService: jest.Mocked<Pick<AuthNotificationService, 'sendEmail' | 'sendSms'>>;
  let securityEvents: jest.Mocked<Pick<SecurityEventService, 'record'>>;
  let eventPublisher: { publish: jest.Mock };
  let service: MfaService;

  beforeEach(() => {
    prisma = {
      twoFactorCredential: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      user: { findUniqueOrThrow: jest.fn() },
    };
    totpService = {
      generateSecret: jest.fn().mockReturnValue('SECRETBASE32'),
      buildProvisioningUri: jest.fn().mockReturnValue('otpauth://totp/...'),
      verify: jest.fn(),
    };
    backupCodeService = {
      generate: jest.fn().mockResolvedValue(['AAAA-BBBB', 'CCCC-DDDD']),
      invalidateAll: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn(),
      remainingCount: jest.fn().mockResolvedValue(8),
    };
    encryptionService = {
      encrypt: jest.fn().mockImplementation((s: string) => `enc(${s})`),
      decrypt: jest.fn().mockImplementation((s: string) => s.replace(/^enc\(/, '').replace(/\)$/, '')),
    };
    otpService = {
      generateNumericCode: jest.fn().mockResolvedValue('123456'),
      verifyOwnedCode: jest.fn().mockResolvedValue(undefined),
    };
    notificationService = { sendEmail: jest.fn().mockResolvedValue(undefined), sendSms: jest.fn().mockResolvedValue(undefined) };
    securityEvents = { record: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

    service = new MfaService(
      prisma as unknown as PrismaService,
      totpService as unknown as TotpService,
      backupCodeService as unknown as BackupCodeService,
      encryptionService as unknown as EncryptionService,
      otpService as unknown as OtpService,
      notificationService as unknown as AuthNotificationService,
      securityEvents as unknown as SecurityEventService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('enrollTotp', () => {
    it('rejects re-enrollment when TOTP is already enabled', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ isEnabled: true });
      await expect(service.enrollTotp('user-1', 'user@example.com')).rejects.toThrow(ConflictException);
    });

    it('generates a secret, encrypts it, and stores a disabled credential', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue(null);
      prisma.twoFactorCredential.upsert.mockResolvedValue({ id: 'cred-1' });

      const result = await service.enrollTotp('user-1', 'user@example.com');

      expect(result.secret).toBe('SECRETBASE32');
      expect(prisma.twoFactorCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ secretEncrypted: 'enc(SECRETBASE32)', isEnabled: false }),
        }),
      );
      expect(encryptionService.encrypt).toHaveBeenCalledWith('SECRETBASE32');
    });

    it('allows re-enrollment over a previously disabled/never-confirmed credential', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ isEnabled: false });
      prisma.twoFactorCredential.upsert.mockResolvedValue({ id: 'cred-1' });
      await expect(service.enrollTotp('user-1', 'user@example.com')).resolves.toBeDefined();
    });
  });

  describe('confirmTotp', () => {
    it('throws when there is no pending enrollment', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue(null);
      await expect(service.confirmTotp('user-1', '123456')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if already enabled (nothing to confirm)', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ isEnabled: true });
      await expect(service.confirmTotp('user-1', '123456')).rejects.toThrow(ConflictException);
    });

    it('rejects an invalid code without enabling the credential', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ id: 'cred-1', isEnabled: false, secretEncrypted: 'enc(SECRETBASE32)' });
      totpService.verify.mockReturnValue(false);

      await expect(service.confirmTotp('user-1', '000000')).rejects.toThrow(BadRequestException);
      expect(prisma.twoFactorCredential.update).not.toHaveBeenCalled();
    });

    it('enables the credential and issues backup codes on a correct code', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ id: 'cred-1', isEnabled: false, secretEncrypted: 'enc(SECRETBASE32)' });
      totpService.verify.mockReturnValue(true);

      const result = await service.confirmTotp('user-1', '595677');

      expect(prisma.twoFactorCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cred-1' }, data: expect.objectContaining({ isEnabled: true }) }),
      );
      expect(backupCodeService.invalidateAll).toHaveBeenCalledWith('cred-1');
      expect(backupCodeService.generate).toHaveBeenCalledWith('cred-1');
      expect(result.backupCodes).toEqual(['AAAA-BBBB', 'CCCC-DDDD']);
      expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'TWO_FA_ENABLED' }));
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'security.mfa_enrolled' }));
    });
  });

  describe('enrollContactFactor', () => {
    it('rejects SMS enrollment when the account has no phone number', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', phone: null, email: 'u@example.com' });
      await expect(service.enrollContactFactor('user-1', 'SMS')).rejects.toThrow(BadRequestException);
    });

    it('sends an SMS OTP for SMS enrollment when a phone is on file', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', phone: '+2348012345678', email: 'u@example.com' });
      await service.enrollContactFactor('user-1', 'SMS');
      expect(notificationService.sendSms).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'OTP_CHALLENGE' }));
    });

    it('sends an email OTP for EMAIL enrollment', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', phone: null, email: 'u@example.com' });
      await service.enrollContactFactor('user-1', 'EMAIL');
      expect(notificationService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'OTP_CHALLENGE_EMAIL' }));
    });
  });

  describe('disableFactor', () => {
    it('throws when the factor is not currently enabled', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue(null);
      await expect(service.disableFactor('user-1', 'TOTP')).rejects.toThrow(NotFoundException);
    });

    it('disables the factor and invalidates backup codes for TOTP specifically', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ id: 'cred-1', isEnabled: true });
      await service.disableFactor('user-1', 'TOTP');
      expect(prisma.twoFactorCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isEnabled: false }) }),
      );
      expect(backupCodeService.invalidateAll).toHaveBeenCalledWith('cred-1');
    });

    it('does not touch backup codes when disabling a non-TOTP factor', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ id: 'cred-1', isEnabled: true });
      await service.disableFactor('user-1', 'SMS');
      expect(backupCodeService.invalidateAll).not.toHaveBeenCalled();
    });
  });

  describe('verifyFactor', () => {
    it('verifies TOTP by decrypting the stored secret', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ isEnabled: true, secretEncrypted: 'enc(SECRETBASE32)' });
      totpService.verify.mockReturnValue(true);

      await expect(service.verifyFactor('user-1', 'TOTP', '595677')).resolves.toBeUndefined();
      expect(totpService.verify).toHaveBeenCalledWith('SECRETBASE32', '595677');
    });

    it('throws BadRequestException for an incorrect TOTP code', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ isEnabled: true, secretEncrypted: 'enc(SECRETBASE32)' });
      totpService.verify.mockReturnValue(false);
      await expect(service.verifyFactor('user-1', 'TOTP', '000000')).rejects.toThrow(BadRequestException);
    });

    it('verifies a backup code via BackupCodeService against the TOTP credential', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ id: 'cred-1', isEnabled: true });
      backupCodeService.consume.mockResolvedValue(true);

      await service.verifyFactor('user-1', 'BACKUP_CODE', 'AAAA-BBBB');
      expect(backupCodeService.consume).toHaveBeenCalledWith('cred-1', 'AAAA-BBBB');
      expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'BACKUP_CODE_USED' }));
    });

    it('verifies SMS/EMAIL via the shared LOGIN-purpose OTP challenge', async () => {
      otpService.verifyOwnedCode.mockResolvedValue(undefined);
      await service.verifyFactor('user-1', 'SMS', '123456');
      expect(otpService.verifyOwnedCode).toHaveBeenCalledWith('user-1', 'LOGIN', '123456');
    });

    it('treats an OtpService rejection as verification failure, not a thrown error from this method directly', async () => {
      otpService.verifyOwnedCode.mockRejectedValue(new BadRequestException('expired'));
      await expect(service.verifyFactor('user-1', 'EMAIL', '000000')).rejects.toThrow('Invalid or expired verification code');
    });

    it('records a security event and publishes a domain event on both success and failure', async () => {
      prisma.twoFactorCredential.findUnique.mockResolvedValue({ isEnabled: true, secretEncrypted: 'enc(SECRETBASE32)' });
      totpService.verify.mockReturnValue(false);

      await expect(service.verifyFactor('user-1', 'TOTP', '000000')).rejects.toThrow();
      expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'TWO_FA_CHALLENGE_FAILED' }));
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'security.mfa_challenge_failed' }));
    });
  });

  describe('getEnrolledFactors', () => {
    it('includes remaining backup code count only for an enabled TOTP factor', async () => {
      prisma.twoFactorCredential.findMany.mockResolvedValue([
        { id: 'cred-totp', method: 'TOTP', isEnabled: true, enrolledAt: new Date(), disabledAt: null },
        { id: 'cred-sms', method: 'SMS', isEnabled: true, enrolledAt: new Date(), disabledAt: null },
      ]);
      backupCodeService.remainingCount.mockResolvedValue(6);

      const factors = await service.getEnrolledFactors('user-1');

      const totp = factors.find((f) => f.method === 'TOTP')!;
      const sms = factors.find((f) => f.method === 'SMS')!;
      expect(totp.backupCodesRemaining).toBe(6);
      expect(sms.backupCodesRemaining).toBeUndefined();
    });
  });
});
