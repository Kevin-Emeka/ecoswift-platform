import { Injectable, Logger } from '@nestjs/common';
import type { CaptchaVerificationResult, CaptchaVerifierPort } from './captcha-verifier.port';

/**
 * The `CAPTCHA_DRIVER=noop` default — always succeeds, never calls out to
 * anything. Correct for local development and every automated test run;
 * never appropriate in production (the same posture `EnvSecretsAdapter`
 * documents for itself in `@ecoswift/secrets`).
 */
@Injectable()
export class NoopCaptchaAdapter implements CaptchaVerifierPort {
  private readonly logger = new Logger(NoopCaptchaAdapter.name);
  private warned = false;

  async verify(): Promise<CaptchaVerificationResult> {
    if (!this.warned) {
      this.logger.warn('CAPTCHA_DRIVER=noop — CAPTCHA verification is disabled. Never use this in production.');
      this.warned = true;
    }
    return { success: true };
  }
}
