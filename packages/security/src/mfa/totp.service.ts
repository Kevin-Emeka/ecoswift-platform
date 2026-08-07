import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { base32Decode, generateBase32Secret } from '../crypto/secure-random.util';

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const ISSUER = 'Ecoswift Bank';
/** ±1 step (±30s) of clock-drift tolerance either side of "now" — same default every caller of `verify()` used before this moved here. */
const DEFAULT_WINDOW_STEPS = 1;

/**
 * TOTP (RFC 6238, built on RFC 4226 HOTP) — hand-rolled rather than a
 * dependency: the algorithm is a compact, precisely-specified HMAC
 * construction (~40 lines including the truncation step), and implementing
 * it directly means zero new supply-chain surface for something this small
 * and this security-sensitive. Verified against the RFC 6238 Appendix B
 * published SHA-1 test vectors (see totp.service.spec.ts).
 *
 * Lives in `@ecoswift/security` rather than duplicated per-service — it
 * originated in `auth-service` (login-time MFA) and moved here once
 * `account-service` needed byte-for-byte identical verification for
 * transfer step-up (Milestone 2). A crypto primitive is exactly the kind
 * of cross-cutting code this codebase's usual "duplicate small glue per
 * service" precedent (see `AuditService`'s doc comment) doesn't apply to —
 * two copies of a security algorithm can drift out of sync in ways a
 * notification-sending helper never could.
 */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return generateBase32Secret(20); // 160 bits — RFC 4226's recommended HOTP secret length
  }

  /** `otpauth://` provisioning URI — what an authenticator app's QR scanner reads. The secret is embedded in plaintext here by design (it's the enrollment moment); this URI is shown to the user exactly once and never persisted. */
  buildProvisioningUri(secret: string, accountEmail: string): string {
    const label = encodeURIComponent(`${ISSUER}:${accountEmail}`);
    const params = new URLSearchParams({
      secret,
      issuer: ISSUER,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(PERIOD_SECONDS),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /** Verifies `code` against `secret` allowing ±`windowSteps` steps of clock drift either side of now. */
  verify(secret: string, code: string, atSeconds: number = Math.floor(Date.now() / 1000), windowSteps = DEFAULT_WINDOW_STEPS): boolean {
    if (!/^\d{6}$/.test(code)) return false;

    const counter = Math.floor(atSeconds / PERIOD_SECONDS);
    for (let drift = -windowSteps; drift <= windowSteps; drift += 1) {
      const candidate = this.generateCode(secret, counter + drift);
      if (this.safeEqual(candidate, code)) return true;
    }
    return false;
  }

  private generateCode(base32Secret: string, counter: number): string {
    const key = base32Decode(base32Secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

    const hmac = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const truncated =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);

    return (truncated % 10 ** DIGITS).toString().padStart(DIGITS, '0');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
