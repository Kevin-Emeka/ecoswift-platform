import { randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { ConfigurationService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import {
  EVENT_PUBLISHER,
  USER_REGISTERED,
  CUSTOMER_REGISTERED,
  EMAIL_VERIFICATION_REQUESTED,
  EMAIL_VERIFIED,
  PHONE_VERIFICATION_REQUESTED,
  PHONE_VERIFIED,
  LOGIN_SUCCEEDED,
  LOGIN_FAILED,
  LOGOUT_SUCCEEDED,
  PASSWORD_CHANGED,
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_COMPLETED,
} from '@ecoswift/event-bus';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { OtpService } from './otp.service';
import { DeviceService } from './device.service';
import { LoginHistoryService } from './login-history.service';
import { AuthNotificationService } from './auth-notification.service';
import { SuspiciousSessionDetectorService } from '../../security/services/suspicious-session-detector.service';
import type { RegisterDto } from '../dto/register.dto';
import type { LoginDto } from '../dto/login.dto';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import type { RequestPhoneVerificationDto } from '../dto/request-phone-verification.dto';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { MfaChallengeResponseDto } from '../dto/mfa-challenge-response.dto';
import type { UserProfileDto } from '../dto/user-profile.dto';
import type { AuthRequestContext } from '../interfaces/auth-request-context.interface';
import { AUTH_DEFAULTS } from '../constants/auth.constants';

/**
 * Orchestrates every Identity & Authentication flow — the application layer
 * over the domain services (`PasswordService`, `TokenService`,
 * `SessionService`, `OtpService`, `DeviceService`, `LoginHistoryService`).
 * Each domain service owns one concern and knows nothing about the others;
 * this class is the only place that sequences them into a full flow, per
 * the layering `domain-architecture.md` describes for Identity & Access.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly otpService: OtpService,
    private readonly deviceService: DeviceService,
    private readonly loginHistoryService: LoginHistoryService,
    private readonly notificationService: AuthNotificationService,
    private readonly configurationService: ConfigurationService,
    private readonly suspiciousSessionDetector: SuspiciousSessionDetectorService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  // ---------------------------------------------------------------------
  // Registration & verification
  // ---------------------------------------------------------------------

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) {
        throw new ConflictException('An account with this phone number already exists');
      }
    }

    const violations = await this.passwordService.validateComplexity(dto.password);
    if (violations.length > 0) {
      throw new BadRequestException({ message: 'Password does not meet policy requirements', violations });
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const customerNumber = await this.generateCustomerNumber();
    // The base self-service role every customer needs immediately (view/update
    // own profile, open own accounts, etc. — Phase 4A's self-service endpoints
    // depend on this). Looked up once, outside the transaction — roles are
    // seeded reference data, not something that changes per-registration.
    const customerRole = await this.prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          actorType: 'CUSTOMER',
          status: 'PENDING_VERIFICATION',
          profile: {
            create: {
              firstName: dto.firstName,
              middleName: dto.middleName,
              lastName: dto.lastName,
              dateOfBirth: new Date(dto.dateOfBirth),
              nationalityId: dto.countryId,
            },
          },
        },
      });

      await tx.customer.create({
        data: {
          userId: createdUser.id,
          customerNumber,
          countryId: dto.countryId,
          tier: 'TIER_0',
          status: 'ACTIVE',
        },
      });

      // Self-granted: a brand-new user is its own "actor" for this one
      // automatic, non-sensitive grant (CUSTOMER.isSensitive === false, so
      // this never needs the maker-checker approval `UserRoleService.assign()`
      // enforces for sensitive roles — a direct create is the transactional,
      // composable equivalent of that same non-sensitive-role code path).
      await tx.userRole.create({
        data: { userId: createdUser.id, roleId: customerRole.id, assignedBy: createdUser.id },
      });

      return createdUser;
    });

    await this.passwordService.recordPasswordHistory(user.id, passwordHash);

    await this.eventPublisher.publish({
      eventType: USER_REGISTERED,
      producerContext: 'auth-service',
      payload: { userId: user.id, email: user.email, actorType: 'CUSTOMER' },
    });
    await this.eventPublisher.publish({
      eventType: CUSTOMER_REGISTERED,
      producerContext: 'auth-service',
      payload: {
        customerId: user.id,
        userId: user.id,
        fullName: `${dto.firstName} ${dto.lastName}`,
        primaryContact: dto.email,
      },
    });

    await this.notificationService.sendEmail({
      userId: user.id,
      toAddress: user.email,
      templateCode: 'WELCOME',
      variables: {
        firstName: dto.firstName,
        portalUrl: this.getCustomerPortalUrl(),
        year: String(new Date().getFullYear()),
      },
    });

    await this.requestEmailVerification(user.id, user.email, dto.firstName);

    return { message: 'Registration successful. Check your email to verify your account.' };
  }

  private async requestEmailVerification(userId: string, email: string, firstName: string): Promise<void> {
    const token = await this.otpService.generateLinkToken(userId, 'EMAIL_VERIFICATION');
    const expiryMinutes = await this.configurationService.getNumber(
      'email_verification.expiry_minutes',
      AUTH_DEFAULTS.emailVerificationTtlMinutes,
    );
    const appUrl = this.getCustomerPortalUrl();

    await this.notificationService.sendEmail({
      userId,
      toAddress: email,
      templateCode: 'EMAIL_VERIFICATION',
      variables: {
        firstName,
        verificationUrl: `${appUrl}/verify-email?token=${token}`,
        expiryMinutes: String(expiryMinutes),
        year: String(new Date().getFullYear()),
      },
    });

    await this.eventPublisher.publish({
      eventType: EMAIL_VERIFICATION_REQUESTED,
      producerContext: 'auth-service',
      payload: { userId, email },
    });
  }

  async resendEmailVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { profile: true } });
    // Same generic response whether or not the account exists / is already
    // verified — an enumeration-safe response, consistent with
    // forgotPassword() below.
    if (user && !user.emailVerifiedAt) {
      await this.requestEmailVerification(user.id, user.email, user.profile?.firstName ?? 'there');
    }
    return { message: 'If that email is registered and not yet verified, a new verification link has been sent.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const { userId } = await this.otpService.verifyLinkToken('EMAIL_VERIFICATION', token);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    await this.eventPublisher.publish({
      eventType: EMAIL_VERIFIED,
      producerContext: 'auth-service',
      payload: { userId: user.id, email: user.email, verifiedAt: new Date().toISOString() },
    });

    return { message: 'Email verified. Your checking account is now active.' };
  }

  async requestPhoneVerification(userId: string, dto: RequestPhoneVerificationDto): Promise<{ message: string }> {
    await this.prisma.user.update({ where: { id: userId }, data: { phone: dto.phone } });

    const code = await this.otpService.generateNumericCode(userId, 'PHONE_VERIFICATION');
    const expiryMinutes = await this.configurationService.getNumber('otp.expiry_minutes', AUTH_DEFAULTS.otpTtlMinutes);

    await this.notificationService.sendSms({
      userId,
      toNumber: dto.phone,
      templateCode: 'OTP_CHALLENGE',
      variables: { code, expiryMinutes: String(expiryMinutes) },
    });

    await this.eventPublisher.publish({
      eventType: PHONE_VERIFICATION_REQUESTED,
      producerContext: 'auth-service',
      payload: { userId, phone: dto.phone },
    });

    return { message: 'A verification code has been sent to your phone.' };
  }

  async verifyPhone(userId: string, code: string): Promise<{ message: string }> {
    await this.otpService.verifyOwnedCode(userId, 'PHONE_VERIFICATION', code);

    const user = await this.prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });

    await this.eventPublisher.publish({
      eventType: PHONE_VERIFIED,
      producerContext: 'auth-service',
      payload: { userId: user.id, phone: user.phone ?? '', verifiedAt: new Date().toISOString() },
    });

    return { message: 'Phone number verified.' };
  }

  // ---------------------------------------------------------------------
  // Login / logout / refresh
  // ---------------------------------------------------------------------

  async login(dto: LoginDto, context: AuthRequestContext): Promise<AuthResponseDto | MfaChallengeResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      await this.recordFailedLogin(dto.email, 'INVALID_CREDENTIALS', context);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.autoUnlockIfExpired(user.id, user.lockedUntil);
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    if (current.status === 'LOCKED' && current.lockedUntil && current.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked due to repeated failed sign-in attempts');
    }
    if (current.status === 'DEACTIVATED' || current.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account cannot sign in');
    }
    if (current.status === 'PENDING_VERIFICATION') {
      throw new UnauthorizedException('Please verify your email address before signing in');
    }

    const passwordMatches = await this.passwordService.verify(current.passwordHash, dto.password);
    if (!passwordMatches) {
      await this.registerFailedAttempt(current.id);
      await this.recordFailedLogin(dto.email, 'INVALID_CREDENTIALS', context, current.id);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (current.failedLoginAttempts > 0 || current.lockedUntil) {
      await this.prisma.user.update({
        where: { id: current.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const rememberMe = dto.rememberMe ?? false;

    // Phase 3C — MFA-at-login. A direct Prisma read rather than injecting
    // `MfaService` (`modules/mfa`) — `MfaModule` imports `AuthModule` for
    // its OTP/notification/token infrastructure, so `AuthModule` depending
    // back on `MfaModule` would be circular. See `auth.module.ts`'s export
    // comment.
    const enabledFactors = await this.prisma.twoFactorCredential.findMany({
      where: { userId: current.id, isEnabled: true },
      select: { method: true },
    });
    if (enabledFactors.length > 0) {
      const mfaToken = await this.tokenService.issueMfaChallengeToken(current.id, rememberMe);
      return {
        mfaRequired: true,
        mfaToken,
        availableMethods: enabledFactors.map((f) => f.method) as ('TOTP' | 'SMS' | 'EMAIL')[],
      };
    }

    return this.completeLogin(current, rememberMe, context);
  }

  /**
   * Finishes a login: device recognition, session + token issuance, login
   * history, `LOGIN_SUCCEEDED`, and the new-device alert. Called directly
   * by `login()` for an account with no MFA enabled, and by
   * `modules/mfa`'s login-completion controller once an MFA challenge
   * verifies successfully — the exact same "an account is now provably
   * signed in" logic either way, so there is only one place it can drift.
   */
  async completeLogin(
    current: { id: string; email: string; actorType: string },
    rememberMe: boolean,
    context: AuthRequestContext,
  ): Promise<AuthResponseDto> {
    const device = await this.deviceService.recognize(current.id, context);
    const refreshTtlDays = await this.tokenService.refreshTokenTtlDays(rememberMe);

    const session = await this.sessionService.createSession({
      userId: current.id,
      deviceId: device.deviceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
    });
    await this.suspiciousSessionDetector.evaluate(current.id, session.id, context.ipAddress);

    const tokens = await this.tokenService.issueTokenPair(current.id, session.id, current.actorType, rememberMe);
    await this.sessionService.setTokenHashes(
      session.id,
      this.tokenService.hashToken(tokens.accessToken),
      this.tokenService.hashToken(tokens.refreshToken),
    );

    await this.prisma.user.update({ where: { id: current.id }, data: { lastLoginAt: new Date() } });
    await this.loginHistoryService.record({
      userId: current.id,
      sessionId: session.id,
      deviceId: device.deviceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      successful: true,
    });

    await this.eventPublisher.publish({
      eventType: LOGIN_SUCCEEDED,
      producerContext: 'auth-service',
      payload: {
        userId: current.id,
        sessionId: session.id,
        deviceId: device.deviceId,
        ipAddress: context.ipAddress,
        isNewDevice: device.isNewDevice,
      },
    });

    if (device.isNewDevice) {
      await this.sendNewDeviceAlert(current.id, current.email, context, device.deviceName);
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
      userId: current.id,
      sessionId: session.id,
    };
  }

  private async sendNewDeviceAlert(
    userId: string,
    email: string,
    context: AuthRequestContext,
    deviceName: string,
  ): Promise<void> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const appUrl = this.getCustomerPortalUrl();

    await this.notificationService.sendEmail({
      userId,
      toAddress: email,
      templateCode: 'LOGIN_NEW_DEVICE',
      variables: {
        firstName: profile?.firstName ?? 'there',
        loginTime: new Date().toISOString(),
        deviceName,
        location: context.ipAddress, // real geo-IP resolution is a documented future enhancement — see docs/authentication.md
        ipAddress: context.ipAddress,
        sessionsUrl: `${appUrl}/settings/sessions`,
        year: String(new Date().getFullYear()),
      },
    });
  }

  async logout(sessionId: string): Promise<{ message: string }> {
    const session = await this.sessionService.findActiveById(sessionId);
    if (!session) {
      return { message: 'Already signed out.' };
    }

    await this.sessionService.revoke(sessionId, 'USER_LOGOUT');

    await this.eventPublisher.publish({
      eventType: LOGOUT_SUCCEEDED,
      producerContext: 'auth-service',
      payload: { userId: session.userId, sessionId },
    });

    return { message: 'Signed out.' };
  }

  /**
   * Refresh token rotation with reuse detection
   * (security-model.md § Session Lifecycle, business-rules.md's
   * "did my transfer double-post" spirit applied to tokens): the presented
   * refresh token's hash must match `Session.refreshTokenHash` **exactly**.
   * A mismatch means either the token is stale (already rotated — someone
   * is replaying an old, already-used token, which is exactly the signal
   * of a stolen refresh token) or forged. Either way, the whole session is
   * revoked immediately rather than just rejecting the one request — a
   * detected replay is treated as a compromise, not a retry.
   */
  async refresh(refreshToken: string, context: AuthRequestContext): Promise<AuthResponseDto> {
    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.sessionService.findActiveById(payload.sessionId);
    if (!session) {
      throw new UnauthorizedException('Session is no longer active');
    }

    const presentedHash = this.tokenService.hashToken(refreshToken);
    if (session.refreshTokenHash !== presentedHash) {
      this.logger.warn(`Refresh token reuse detected for session ${session.id} — revoking session`);
      await this.sessionService.revoke(session.id, 'REFRESH_TOKEN_REUSE_DETECTED');
      throw new UnauthorizedException('Refresh token has already been used — session revoked for your protection');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      await this.sessionService.revoke(session.id, 'ACCOUNT_NOT_ACTIVE');
      throw new UnauthorizedException('This account cannot sign in');
    }

    // Rotation: issue a brand new pair, overwrite the session's hashes —
    // the old refresh token is now permanently invalid (its hash no longer
    // matches anything), whether or not it's ever presented again.
    const tokens = await this.tokenService.issueTokenPair(user.id, session.id, user.actorType, false);
    await this.sessionService.setTokenHashes(
      session.id,
      this.tokenService.hashToken(tokens.accessToken),
      this.tokenService.hashToken(tokens.refreshToken),
    );
    await this.prisma.session.update({
      where: { id: session.id },
      data: { ipAddress: context.ipAddress, userAgent: context.userAgent ?? session.userAgent },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
      userId: user.id,
      sessionId: session.id,
    };
  }

  // ---------------------------------------------------------------------
  // Password reset / change
  // ---------------------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Always the same response, whether or not the email is registered —
    // an enumeration-safe endpoint never confirms which emails have
    // accounts (security-model.md's general posture on information
    // leakage through error/response differences).
    if (user) {
      const token = await this.otpService.generateLinkToken(user.id, 'PASSWORD_RESET');
      const expiryMinutes = await this.configurationService.getNumber(
        'password_reset.expiry_minutes',
        AUTH_DEFAULTS.passwordResetTtlMinutes,
      );
      const appUrl = this.getCustomerPortalUrl();
      const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });

      await this.notificationService.sendEmail({
        userId: user.id,
        toAddress: user.email,
        templateCode: 'PASSWORD_RESET_REQUEST',
        variables: {
          firstName: profile?.firstName ?? 'there',
          resetUrl: `${appUrl}/reset-password?token=${token}`,
          expiryMinutes: String(expiryMinutes),
          requestIp: 'redacted', // never echo the requester's own IP into an email an attacker requested
          requestedAt: new Date().toISOString(),
          year: String(new Date().getFullYear()),
        },
      });

      await this.eventPublisher.publish({
        eventType: PASSWORD_RESET_REQUESTED,
        producerContext: 'auth-service',
        payload: { userId: user.id, email: user.email },
      });
    }

    return { message: 'If that email is registered, a password reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { userId } = await this.otpService.verifyLinkToken('PASSWORD_RESET', dto.token);

    await this.assertNotReusedAndPolicyCompliant(userId, dto.newPassword);
    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.passwordService.recordPasswordHistory(userId, passwordHash);

    // Resetting a password invalidates every existing session — a stolen
    // session shouldn't survive the very action meant to recover the
    // account (business-rules.md § Password Policy).
    await this.sessionService.revokeAllForUser(userId, 'PASSWORD_RESET');

    await this.eventPublisher.publish({
      eventType: PASSWORD_RESET_COMPLETED,
      producerContext: 'auth-service',
      payload: { userId },
    });
    await this.eventPublisher.publish({
      eventType: PASSWORD_CHANGED,
      producerContext: 'auth-service',
      payload: { userId, changedVia: 'PASSWORD_RESET' },
    });

    await this.sendPasswordChangedNotice(userId);

    return { message: 'Password reset. Please sign in again with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, currentSessionId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const currentMatches = await this.passwordService.verify(user.passwordHash, dto.currentPassword);
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.assertNotReusedAndPolicyCompliant(userId, dto.newPassword);
    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.passwordService.recordPasswordHistory(userId, passwordHash);

    // Self-service change keeps the session that made the change alive;
    // every other session is invalidated (business-rules.md § Password
    // Policy — "the session used to make the change survives; every other
    // device is logged out").
    await this.sessionService.revokeAllForUser(userId, 'PASSWORD_CHANGED', currentSessionId);

    await this.eventPublisher.publish({
      eventType: PASSWORD_CHANGED,
      producerContext: 'auth-service',
      payload: { userId, changedVia: 'SELF_SERVICE' },
    });

    await this.sendPasswordChangedNotice(userId);

    return { message: 'Password changed.' };
  }

  private async assertNotReusedAndPolicyCompliant(userId: string, newPassword: string): Promise<void> {
    const violations = await this.passwordService.validateComplexity(newPassword);
    if (violations.length > 0) {
      throw new BadRequestException({ message: 'Password does not meet policy requirements', violations });
    }
    if (await this.passwordService.isReusedPassword(userId, newPassword)) {
      throw new BadRequestException('Password must not match a recently used password');
    }
  }

  private async sendPasswordChangedNotice(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.notificationService.sendEmail({
      userId,
      toAddress: user.email,
      templateCode: 'PASSWORD_CHANGED',
      variables: { timestamp: new Date().toISOString() },
    });
  }

  // ---------------------------------------------------------------------
  // Account lifecycle
  // ---------------------------------------------------------------------

  async deactivateAccount(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED' } });
    await this.sessionService.revokeAllForUser(userId, 'ACCOUNT_DEACTIVATED');
    return { message: 'Your account has been deactivated.' };
  }

  async getCurrentUser(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, customer: true },
    });

    return {
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      phone: user.phone ?? undefined,
      phoneVerified: user.phoneVerifiedAt !== null,
      firstName: user.profile?.firstName ?? '',
      lastName: user.profile?.lastName ?? '',
      status: user.status,
      customerNumber: user.customer?.customerNumber,
    };
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private async recordFailedLogin(
    identifier: string,
    reason: string,
    context: AuthRequestContext,
    userId?: string,
  ): Promise<void> {
    if (userId) {
      await this.loginHistoryService.record({
        userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        successful: false,
        failureReason: reason,
      });
    }
    await this.eventPublisher.publish({
      eventType: LOGIN_FAILED,
      producerContext: 'auth-service',
      payload: { identifier, reason, ipAddress: context.ipAddress },
    });
  }

  /** `LockoutPolicy` (business-rules.md § Login & Session): failed attempts within the lockout window escalate to a lock; exceeding max attempts locks the account. */
  private async registerFailedAttempt(userId: string): Promise<void> {
    const maxAttempts = await this.configurationService.getNumber(
      'account.max_failed_login_attempts',
      AUTH_DEFAULTS.maxFailedLoginAttempts,
    );
    const lockoutMinutes = await this.configurationService.getNumber(
      'account.lockout_duration_minutes',
      AUTH_DEFAULTS.lockoutDurationMinutes,
    );

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (user.failedLoginAttempts >= maxAttempts) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'LOCKED', lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
      });
    }
  }

  /** A lock is time-boxed, not permanent — once `lockedUntil` has passed, the next login attempt is evaluated normally again. */
  private async autoUnlockIfExpired(userId: string, lockedUntil: Date | null): Promise<void> {
    if (lockedUntil && lockedUntil <= new Date()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', lockedUntil: null, failedLoginAttempts: 0 },
      });
    }
  }

  private async generateCustomerNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `ESB${randomInt(100_000_000, 999_999_999)}`;
      const existing = await this.prisma.customer.findUnique({ where: { customerNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique customer number');
  }

  /**
   * `CUSTOMER_PORTAL_URL` is a deployment-specific environment variable
   * (already in `packages/config/src/env.schema.ts` since Phase 2A/2B's
   * branding work), not a business-editable `ApplicationSetting` — it
   * differs between dev/staging/production by environment, not by a
   * staff decision, so it belongs with the other env-driven URLs, not in
   * `ConfigurationService`.
   */
  private getCustomerPortalUrl(): string {
    return process.env.CUSTOMER_PORTAL_URL ?? 'https://www.ecoswiftbank.com';
  }
}
