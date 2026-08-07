/**
 * Defaults for every token/policy timing value used across the auth module.
 * These are fallbacks only — `ConfigurationService` (Phase 2C,
 * `@ecoswift/config`) is the actual source of truth at runtime, reading the
 * seeded `ApplicationSetting` rows (`prisma/seed.ts`) so operations can
 * change them without a deploy. Falling back here means a fresh environment
 * still works correctly before/if those settings rows are ever missing.
 */
export const AUTH_DEFAULTS = {
  accessTokenTtlMinutes: 15,
  refreshTokenTtlDays: 7,
  refreshTokenRememberMeTtlDays: 30,
  emailVerificationTtlMinutes: 60,
  passwordResetTtlMinutes: 30,
  otpTtlMinutes: 5,
  otpMaxAttempts: 5,
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  maxConcurrentSessions: 5,
  passwordMinLength: 12,
  passwordHistoryCount: 5,
  /** Phase 3C — MFA / step-up. */
  mfaChallengeTtlMinutes: 5,
  stepUpTtlMinutes: 10,
  backupCodeCount: 10,
  totpWindowSteps: 1, // ±1 step (±30s) of clock-drift tolerance either side of "now"
} as const;

/** JWT `token_use` claim — distinguishes an access token from a refresh token issued from the same signer. */
export const TOKEN_USE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  /** Phase 3C — issued after password verification when 2FA is enabled; only redeemable at `/v1/auth/mfa/verify`, for nothing else. */
  MFA_CHALLENGE: 'mfa_challenge',
  /** Phase 3C — issued after a fresh MFA re-verification on an already-authenticated session; proves recent step-up for a sensitive action. */
  STEP_UP: 'step_up',
} as const;

export const AUTH_COOKIE_NAME = 'ecoswift_refresh_token';
