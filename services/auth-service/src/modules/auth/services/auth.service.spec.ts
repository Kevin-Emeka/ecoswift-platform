import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '@ecoswift/database';
import type { ConfigurationService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { PasswordService } from './password.service';
import type { TokenService } from './token.service';
import type { SessionService } from './session.service';
import type { OtpService } from './otp.service';
import type { DeviceService } from './device.service';
import type { LoginHistoryService } from './login-history.service';
import type { AuthNotificationService } from './auth-notification.service';
import type { SuspiciousSessionDetectorService } from '../../security/services/suspicious-session-detector.service';
import type { AuthRequestContext } from '../interfaces/auth-request-context.interface';

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; create: jest.Mock };
    customer: { create: jest.Mock; findUnique: jest.Mock };
    profile: { findUnique: jest.Mock };
    session: { update: jest.Mock };
    twoFactorCredential: { findMany: jest.Mock };
    role: { findUniqueOrThrow: jest.Mock };
    userRole: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash' | 'verify' | 'validateComplexity' | 'isReusedPassword' | 'recordPasswordHistory'>>;
  let tokenService: jest.Mocked<Pick<TokenService, 'issueTokenPair' | 'verifyRefreshToken' | 'hashToken' | 'refreshTokenTtlDays'>>;
  let sessionService: jest.Mocked<Pick<SessionService, 'createSession' | 'setTokenHashes' | 'findActiveById' | 'revoke' | 'revokeAllForUser'>>;
  let otpService: jest.Mocked<Pick<OtpService, 'generateLinkToken' | 'generateNumericCode' | 'verifyLinkToken' | 'verifyOwnedCode'>>;
  let deviceService: jest.Mocked<Pick<DeviceService, 'recognize'>>;
  let loginHistoryService: jest.Mocked<Pick<LoginHistoryService, 'record'>>;
  let notificationService: jest.Mocked<Pick<AuthNotificationService, 'sendEmail' | 'sendSms'>>;
  let configurationService: { getNumber: jest.Mock; getBoolean: jest.Mock; getSetting: jest.Mock };
  let eventPublisher: { publish: jest.Mock };
  let suspiciousSessionDetector: jest.Mocked<Pick<SuspiciousSessionDetectorService, 'evaluate'>>;
  let service: AuthService;

  const context: AuthRequestContext = { ipAddress: '127.0.0.1', userAgent: 'jest-test-agent' };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      customer: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Ada' }) },
      session: { update: jest.fn().mockResolvedValue({}) },
      // No user in this suite has MFA enabled by default — an empty result keeps every existing login test on the pre-Phase-3C, no-MFA path.
      twoFactorCredential: { findMany: jest.fn().mockResolvedValue([]) },
      role: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'role-customer', name: 'CUSTOMER' }) },
      userRole: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      verify: jest.fn().mockResolvedValue(true),
      validateComplexity: jest.fn().mockResolvedValue([]),
      isReusedPassword: jest.fn().mockResolvedValue(false),
      recordPasswordHistory: jest.fn().mockResolvedValue(undefined),
    };
    tokenService = {
      issueTokenPair: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresInSeconds: 900,
        refreshTokenExpiresAt: new Date(Date.now() + 1000),
      }),
      verifyRefreshToken: jest.fn(),
      hashToken: jest.fn().mockImplementation((token: string) => `hash(${token})`),
      refreshTokenTtlDays: jest.fn().mockResolvedValue(7),
    };
    sessionService = {
      createSession: jest.fn().mockResolvedValue({ id: 'session-1', userId: 'user-1' }),
      setTokenHashes: jest.fn().mockResolvedValue(undefined),
      findActiveById: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    otpService = {
      generateLinkToken: jest.fn().mockResolvedValue('link-token'),
      generateNumericCode: jest.fn().mockResolvedValue('123456'),
      verifyLinkToken: jest.fn(),
      verifyOwnedCode: jest.fn().mockResolvedValue(undefined),
    };
    deviceService = {
      recognize: jest
        .fn()
        .mockResolvedValue({ deviceId: 'device-1', isNewDevice: false, isTrusted: false, deviceName: 'Test Device' }),
    };
    loginHistoryService = { record: jest.fn().mockResolvedValue(undefined) };
    notificationService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
    };
    configurationService = {
      getNumber: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
      getBoolean: jest.fn().mockImplementation((_key: string, fallback: boolean) => Promise.resolve(fallback)),
      getSetting: jest.fn().mockResolvedValue(undefined),
    };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    suspiciousSessionDetector = { evaluate: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
      sessionService as unknown as SessionService,
      otpService as unknown as OtpService,
      deviceService as unknown as DeviceService,
      loginHistoryService as unknown as LoginHistoryService,
      notificationService as unknown as AuthNotificationService,
      configurationService as unknown as ConfigurationService,
      suspiciousSessionDetector as unknown as SuspiciousSessionDetectorService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('register', () => {
    const dto = {
      email: 'new.user@example.com',
      phone: '+15551234567',
      password: 'Str0ng!Passw0rd',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      countryId: 'country-1',
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: dto.email });
    });

    it('rejects a duplicate email before touching password policy or hashing', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(passwordService.validateComplexity).not.toHaveBeenCalled();
    });

    it('rejects a duplicate phone number', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing-user' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('rejects a password that fails complexity policy without creating a user', async () => {
      passwordService.validateComplexity.mockResolvedValue([{ rule: 'symbol', message: 'needs a symbol' }]);
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the user as PENDING_VERIFICATION, records password history, and sends welcome + verification emails', async () => {
      const result = await service.register(dto);

      expect(result.message).toMatch(/verify your account/i);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_VERIFICATION' }) }),
      );
      expect(passwordService.recordPasswordHistory).toHaveBeenCalledWith('user-1', 'hashed-password');
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'WELCOME' }),
      );
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'EMAIL_VERIFICATION' }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.user_registered' }),
      );
      expect(prisma.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', roleId: 'role-customer' }) }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('activates the account and publishes EMAIL_VERIFIED', async () => {
      otpService.verifyLinkToken.mockResolvedValue({ userId: 'user-1' });
      prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

      const result = await service.verifyEmail('a-valid-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerifiedAt: expect.any(Date), status: 'ACTIVE' },
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.email_verified' }),
      );
      expect(result.message).toMatch(/now active/i);
    });
  });

  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'CorrectPassword!1', rememberMe: false };
    const activeUser = {
      id: 'user-1',
      email: dto.email,
      passwordHash: 'stored-hash',
      status: 'ACTIVE',
      actorType: 'CUSTOMER',
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    it('throws generic Unauthorized and logs a failed attempt when the email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto, context)).rejects.toThrow('Invalid email or password');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.login_failed' }),
      );
      // No userId is known for a nonexistent account, so no LoginHistory row can be attributed to anyone.
      expect(loginHistoryService.record).not.toHaveBeenCalled();
    });

    it('blocks sign-in for an account still PENDING_VERIFICATION', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'PENDING_VERIFICATION' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...activeUser, status: 'PENDING_VERIFICATION' });

      await expect(service.login(dto, context)).rejects.toThrow('Please verify your email address before signing in');
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('blocks sign-in for a DEACTIVATED account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'DEACTIVATED' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...activeUser, status: 'DEACTIVATED' });

      await expect(service.login(dto, context)).rejects.toThrow('This account cannot sign in');
    });

    it('blocks sign-in while LOCKED and lockedUntil is still in the future', async () => {
      const lockedUser = { ...activeUser, status: 'LOCKED', lockedUntil: new Date(Date.now() + 60_000) };
      prisma.user.findUnique.mockResolvedValue(lockedUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(lockedUser);

      await expect(service.login(dto, context)).rejects.toThrow(
        'Account is temporarily locked due to repeated failed sign-in attempts',
      );
    });

    it('auto-unlocks and proceeds normally once lockedUntil has passed', async () => {
      const expiredLock = { ...activeUser, status: 'LOCKED', lockedUntil: new Date(Date.now() - 1000) };
      prisma.user.findUnique.mockResolvedValue(expiredLock);
      // After autoUnlockIfExpired runs, the service re-reads the user — reflect the unlocked state here.
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...activeUser, status: 'ACTIVE', lockedUntil: null });
      prisma.user.update.mockResolvedValue({});

      await service.login(dto, context);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'ACTIVE', lockedUntil: null, failedLoginAttempts: 0 },
      });
      expect(sessionService.createSession).toHaveBeenCalled();
    });

    it('increments failedLoginAttempts and records history on a wrong password, without locking below the threshold', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(activeUser);
      passwordService.verify.mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({ id: 'user-1', failedLoginAttempts: 1 });

      await expect(service.login(dto, context)).rejects.toThrow('Invalid email or password');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      expect(loginHistoryService.record).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', successful: false }),
      );
      // Only 1 of 5 allowed attempts — should not have locked the account.
      expect(prisma.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'LOCKED' }) }),
      );
    });

    it('locks the account once failedLoginAttempts reaches the configured maximum', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(activeUser);
      passwordService.verify.mockResolvedValue(false);
      configurationService.getNumber.mockImplementation((key: string, fallback: number) =>
        Promise.resolve(key === 'account.max_failed_login_attempts' ? 5 : fallback),
      );
      prisma.user.update.mockResolvedValue({ id: 'user-1', failedLoginAttempts: 5 });

      await expect(service.login(dto, context)).rejects.toThrow('Invalid email or password');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'LOCKED', lockedUntil: expect.any(Date) },
      });
    });

    it('on success: creates a session, issues tokens, records history, and publishes LOGIN_SUCCEEDED', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(activeUser);
      prisma.user.update.mockResolvedValue({});

      const result = await service.login(dto, context);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresInSeconds: 900,
        userId: 'user-1',
        sessionId: 'session-1',
      });
      expect(sessionService.setTokenHashes).toHaveBeenCalledWith('session-1', 'hash(access-token)', 'hash(refresh-token)');
      expect(loginHistoryService.record).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', successful: true }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.login_succeeded' }),
      );
    });

    it('sends a new-device alert email when the device is unrecognized', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(activeUser);
      prisma.user.update.mockResolvedValue({});
      deviceService.recognize.mockResolvedValue({
        deviceId: 'device-2',
        isNewDevice: true,
        isTrusted: false,
        deviceName: 'New Device',
      });

      await service.login(dto, context);

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'LOGIN_NEW_DEVICE' }),
      );
    });

    it('does not send a new-device alert for a recognized device', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(activeUser);
      prisma.user.update.mockResolvedValue({});

      await service.login(dto, context);

      expect(notificationService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'LOGIN_NEW_DEVICE' }),
      );
    });
  });

  describe('refresh', () => {
    const validPayload = { sub: 'user-1', sessionId: 'session-1', tokenUse: 'refresh' as const, jti: 'jti-1' };
    // Only the fields AuthService.refresh() actually reads — cast past the rest of Prisma's Session shape.
    const activeSession = {
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash(current-refresh-token)',
      userAgent: 'old-agent',
    } as unknown as NonNullable<Awaited<ReturnType<SessionService['findActiveById']>>>;

    it('rejects an unparseable/expired refresh token before touching the session store', async () => {
      tokenService.verifyRefreshToken.mockRejectedValue(new Error('jwt expired'));
      await expect(service.refresh('garbage', context)).rejects.toThrow('Invalid or expired refresh token');
      expect(sessionService.findActiveById).not.toHaveBeenCalled();
    });

    it('rejects when the session is no longer active', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(validPayload);
      sessionService.findActiveById.mockResolvedValue(null);

      await expect(service.refresh('current-refresh-token', context)).rejects.toThrow('Session is no longer active');
    });

    it('detects reuse of a stale refresh token, revokes the whole session, and does not rotate', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(validPayload);
      sessionService.findActiveById.mockResolvedValue(activeSession);
      // Presented token hashes to something that no longer matches the session's current hash.
      tokenService.hashToken.mockReturnValue('hash(a-stale-already-rotated-token)');

      await expect(service.refresh('a-stale-already-rotated-token', context)).rejects.toThrow(
        'Refresh token has already been used — session revoked for your protection',
      );
      expect(sessionService.revoke).toHaveBeenCalledWith('session-1', 'REFRESH_TOKEN_REUSE_DETECTED');
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('rotates tokens and updates the session hashes on a valid, current refresh token', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(validPayload);
      sessionService.findActiveById.mockResolvedValue(activeSession);
      tokenService.hashToken.mockImplementation((token: string) => `hash(${token})`);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', actorType: 'CUSTOMER' });

      const result = await service.refresh('current-refresh-token', context);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(sessionService.setTokenHashes).toHaveBeenCalledWith('session-1', 'hash(access-token)', 'hash(refresh-token)');
      expect(sessionService.revoke).not.toHaveBeenCalled();
    });

    it('revokes the session and rejects when the underlying account is no longer active', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(validPayload);
      sessionService.findActiveById.mockResolvedValue(activeSession);
      tokenService.hashToken.mockImplementation((token: string) => `hash(${token})`);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'SUSPENDED' });

      await expect(service.refresh('current-refresh-token', context)).rejects.toThrow('This account cannot sign in');
      expect(sessionService.revoke).toHaveBeenCalledWith('session-1', 'ACCOUNT_NOT_ACTIVE');
    });
  });

  describe('logout', () => {
    it('revokes the session and publishes LOGOUT_SUCCEEDED when the session is active', async () => {
      sessionService.findActiveById.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      } as unknown as NonNullable<Awaited<ReturnType<SessionService['findActiveById']>>>);

      const result = await service.logout('session-1');

      expect(sessionService.revoke).toHaveBeenCalledWith('session-1', 'USER_LOGOUT');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.logout_succeeded' }),
      );
      expect(result.message).toBe('Signed out.');
    });

    it('is idempotent for a session that is already inactive', async () => {
      sessionService.findActiveById.mockResolvedValue(null);

      const result = await service.logout('already-gone');

      expect(sessionService.revoke).not.toHaveBeenCalled();
      expect(result.message).toBe('Already signed out.');
    });
  });

  describe('forgotPassword', () => {
    it('sends a reset email and publishes an event when the account exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

      const result = await service.forgotPassword({ email: 'user@example.com' });

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'PASSWORD_RESET_REQUEST' }),
      );
      expect(result.message).toBe('If that email is registered, a password reset link has been sent.');
    });

    it('returns the identical generic message and sends no email for a nonexistent account (enumeration-safe)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nobody@example.com' });

      expect(notificationService.sendEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('If that email is registered, a password reset link has been sent.');
    });
  });

  describe('resetPassword', () => {
    it('resolves the user from the token, revokes every session, and notifies the user', async () => {
      otpService.verifyLinkToken.mockResolvedValue({ userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

      const result = await service.resetPassword({ token: 'a-valid-reset-token', newPassword: 'NewStr0ng!Pass' });

      expect(passwordService.isReusedPassword).toHaveBeenCalledWith('user-1', 'NewStr0ng!Pass');
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1', 'PASSWORD_RESET');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.password_reset_completed' }),
      );
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'PASSWORD_CHANGED' }),
      );
      expect(result.message).toMatch(/sign in again/i);
    });

    it('rejects a reused password without touching any session', async () => {
      otpService.verifyLinkToken.mockResolvedValue({ userId: 'user-1' });
      passwordService.isReusedPassword.mockResolvedValue(true);

      await expect(
        service.resetPassword({ token: 'a-valid-reset-token', newPassword: 'OldPassword!1' }),
      ).rejects.toThrow(BadRequestException);
      expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('rejects an incorrect current password without revoking any session', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: 'stored-hash' });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'NewStr0ng!Pass' }, 'session-1'),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('keeps the current session alive while revoking every other one', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: 'stored-hash', email: 'user@example.com' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
      passwordService.verify.mockResolvedValue(true);

      const result = await service.changePassword(
        'user-1',
        { currentPassword: 'CorrectPassword!1', newPassword: 'NewStr0ng!Pass' },
        'current-session-id',
      );

      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1', 'PASSWORD_CHANGED', 'current-session-id');
      expect(result.message).toBe('Password changed.');
    });
  });

  describe('deactivateAccount', () => {
    it('marks the account DEACTIVATED and revokes every session', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.deactivateAccount('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { status: 'DEACTIVATED' } });
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1', 'ACCOUNT_DEACTIVATED');
    });
  });
});
