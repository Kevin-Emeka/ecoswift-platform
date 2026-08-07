import { BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import type { PrismaService } from '@ecoswift/database';
import type { ConfigurationService } from '@ecoswift/config';

describe('OtpService', () => {
  let prisma: {
    otpChallenge: { updateMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let configurationService: { getNumber: jest.Mock };
  let tokenService: TokenService;
  let service: OtpService;

  beforeEach(() => {
    prisma = {
      otpChallenge: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    configurationService = {
      getNumber: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
    };
    // Real TokenService.hashToken is pure (SHA-256, no DI-relevant state) — using the real implementation
    // means the hash the test computes for assertions is guaranteed to match what OtpService persists.
    tokenService = new TokenService(
      {} as never,
      {} as never,
      {} as never,
    );
    service = new OtpService(
      prisma as unknown as PrismaService,
      tokenService,
      configurationService as unknown as ConfigurationService,
    );
  });

  describe('generateNumericCode / generateLinkToken', () => {
    it('produces a 6-digit numeric code and persists only its hash', async () => {
      const code = await service.generateNumericCode('user-1', 'PHONE_VERIFICATION');
      expect(code).toMatch(/^\d{6}$/);

      const createArgs = prisma.otpChallenge.create.mock.calls[0][0];
      expect(createArgs.data.codeHash).toEqual(tokenService.hashToken(code));
      expect(createArgs.data.codeHash).not.toEqual(code);
    });

    it('produces a URL-safe link token and persists only its hash', async () => {
      const token = await service.generateLinkToken('user-1', 'EMAIL_VERIFICATION');
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThan(30);

      const createArgs = prisma.otpChallenge.create.mock.calls[0][0];
      expect(createArgs.data.codeHash).toEqual(tokenService.hashToken(token));
    });

    it('expires any previous pending challenge for the same (user, purpose) before issuing a new one', async () => {
      await service.generateLinkToken('user-1', 'PASSWORD_RESET');
      expect(prisma.otpChallenge.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', purpose: 'PASSWORD_RESET', status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('verifyOwnedCode', () => {
    it('succeeds and marks the challenge VERIFIED when the code matches', async () => {
      const code = '123456';
      prisma.otpChallenge.findFirst.mockResolvedValue({
        id: 'challenge-1',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: tokenService.hashToken(code),
      });

      await service.verifyOwnedCode('user-1', 'PHONE_VERIFICATION', code);

      expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { status: 'VERIFIED', verifiedAt: expect.any(Date) },
      });
    });

    it('throws and increments attempts when the code does not match', async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue({
        id: 'challenge-1',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: tokenService.hashToken('999999'),
      });

      await expect(service.verifyOwnedCode('user-1', 'PHONE_VERIFICATION', '000000')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('throws without touching the DB when no pending challenge exists', async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue(null);
      await expect(service.verifyOwnedCode('user-1', 'PHONE_VERIFICATION', '123456')).rejects.toThrow(
        'No active verification request found',
      );
      expect(prisma.otpChallenge.update).not.toHaveBeenCalled();
    });

    it('throws and marks EXPIRED when the challenge is past expiry, even if the code is correct', async () => {
      const code = '123456';
      prisma.otpChallenge.findFirst.mockResolvedValue({
        id: 'challenge-1',
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: tokenService.hashToken(code),
      });

      await expect(service.verifyOwnedCode('user-1', 'PHONE_VERIFICATION', code)).rejects.toThrow(
        'Verification code has expired',
      );
      expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { status: 'EXPIRED' },
      });
    });

    it('throws and marks FAILED once attempts have reached maxAttempts', async () => {
      const code = '123456';
      prisma.otpChallenge.findFirst.mockResolvedValue({
        id: 'challenge-1',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 5,
        maxAttempts: 5,
        codeHash: tokenService.hashToken(code),
      });

      await expect(service.verifyOwnedCode('user-1', 'PHONE_VERIFICATION', code)).rejects.toThrow(
        'Too many attempts — request a new code',
      );
      expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { status: 'FAILED' },
      });
    });
  });

  describe('verifyLinkToken', () => {
    it('resolves the userId for a matching, unexpired link token', async () => {
      const token = 'a-long-random-link-token';
      prisma.otpChallenge.findFirst.mockResolvedValue({
        id: 'challenge-1',
        userId: 'user-42',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: tokenService.hashToken(token),
      });

      await expect(service.verifyLinkToken('EMAIL_VERIFICATION', token)).resolves.toEqual({ userId: 'user-42' });
    });

    it('looks the challenge up by hash directly (no userId required from the caller)', async () => {
      const token = 'a-long-random-link-token';
      prisma.otpChallenge.findFirst.mockResolvedValue({
        id: 'challenge-1',
        userId: 'user-42',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: tokenService.hashToken(token),
      });

      await service.verifyLinkToken('EMAIL_VERIFICATION', token);

      expect(prisma.otpChallenge.findFirst).toHaveBeenCalledWith({
        where: { purpose: 'EMAIL_VERIFICATION', status: 'PENDING', codeHash: tokenService.hashToken(token) },
      });
    });

    it('throws for an unknown token rather than resolving any userId', async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue(null);
      await expect(service.verifyLinkToken('EMAIL_VERIFICATION', 'unknown-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
