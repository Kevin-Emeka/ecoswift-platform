import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CaptchaVerificationResult, CaptchaVerifierPort } from './captcha-verifier.port';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface RecaptchaApiResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * `CAPTCHA_DRIVER=recaptcha` — verifies a client-obtained reCAPTCHA v3
 * token against Google's `siteverify` endpoint. Below `CAPTCHA_MIN_SCORE`
 * (default 0.5) is treated as a failed verification even when Google's own
 * `success` flag is `true` — v3 doesn't have a pass/fail challenge, only a
 * confidence score, so the pass/fail threshold is this deployment's own
 * policy decision, not Google's.
 */
@Injectable()
export class RecaptchaAdapter implements CaptchaVerifierPort {
  private readonly logger = new Logger(RecaptchaAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string, context?: { remoteIp?: string; action?: string }): Promise<CaptchaVerificationResult> {
    const secret = this.configService.get<string>('captcha.secretKey');
    if (!secret) {
      throw new Error('CAPTCHA_SECRET_KEY is not configured but CAPTCHA_DRIVER=recaptcha');
    }
    const minScore = this.configService.get<number>('captcha.minScore') ?? 0.5;

    const params = new URLSearchParams({ secret, response: token });
    if (context?.remoteIp) params.set('remoteip', context.remoteIp);

    let payload: RecaptchaApiResponse;
    try {
      const res = await fetch(VERIFY_URL, { method: 'POST', body: params });
      payload = (await res.json()) as RecaptchaApiResponse;
    } catch (error) {
      this.logger.error('reCAPTCHA verification request failed', error as Error);
      return { success: false, reason: 'verification_request_failed' };
    }

    if (!payload.success) {
      return { success: false, reason: payload['error-codes']?.join(',') ?? 'rejected' };
    }
    if (context?.action && payload.action && payload.action !== context.action) {
      return { success: false, score: payload.score, reason: 'action_mismatch' };
    }
    if (payload.score !== undefined && payload.score < minScore) {
      return { success: false, score: payload.score, reason: 'below_min_score' };
    }

    return { success: true, score: payload.score };
  }
}
