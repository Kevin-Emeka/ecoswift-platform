import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface SignatureVerificationInput {
  /** The raw, unparsed request body — signing must happen over exactly what was sent, not a re-serialized/reformatted version of it. */
  rawBody: string;
  /** Unix seconds the signature was generated at, from the request (e.g. an `X-Signature-Timestamp` header). */
  timestamp: number;
  signature: string;
  secret: string;
}

const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * API Signing Hooks (Phase 3C brief § API Security) — HMAC-SHA256 request
 * signature verification, the mechanism a future outbound-webhook receiver
 * or partner-API integration would use to prove a request actually came
 * from Ecoswift Bank (or, symmetrically, that an inbound partner request
 * is genuine) rather than being forged. Nothing in this phase calls this
 * from a live endpoint — it's an extension point, provided complete and
 * tested so a Phase 3D+ webhook/partner-API feature can adopt it directly.
 *
 * Signs `"${timestamp}.${rawBody}"`, HMAC-SHA256 with the shared secret,
 * hex-encoded — timestamp is *part of what's signed*, not just a
 * side-channel freshness check, so a captured signature can't be replayed
 * against a different payload by pairing it with a fresh timestamp.
 */
@Injectable()
export class ApiSigningService {
  sign(rawBody: string, timestamp: number, secret: string): string {
    return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  }

  verify(input: SignatureVerificationInput, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - input.timestamp) > toleranceSeconds) {
      return false; // stale or clock-skewed beyond tolerance — reject before even computing the HMAC
    }

    const expected = this.sign(input.rawBody, input.timestamp, input.secret);
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(input.signature, 'hex');

    // Different lengths would make timingSafeEqual throw rather than return false — length itself isn't secret, so checking it first is safe.
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  }
}
