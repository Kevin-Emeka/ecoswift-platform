export const CAPTCHA_VERIFIER = Symbol('CAPTCHA_VERIFIER');

export interface CaptchaVerificationResult {
  success: boolean;
  /** 0–1 confidence score, where the driver supports one (reCAPTCHA v3). Undefined for pass/fail-only drivers. */
  score?: number;
  reason?: string;
}

/**
 * CAPTCHA Integration Abstraction (Phase 3C brief § Account Protection).
 * Endpoints that want CAPTCHA protection (registration, login, forgot-
 * password) depend on this interface, never on a specific vendor SDK — the
 * concrete driver is chosen entirely by `CAPTCHA_DRIVER` (`NoopCaptchaAdapter`
 * for dev/test, `RecaptchaAdapter` for a real deployment) and swapped
 * without touching a single call site.
 */
export interface CaptchaVerifierPort {
  verify(token: string, context?: { remoteIp?: string; action?: string }): Promise<CaptchaVerificationResult>;
}
