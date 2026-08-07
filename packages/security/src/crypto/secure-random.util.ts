import { randomBytes, randomInt } from 'node:crypto';

/**
 * Centralized secure-random helpers — every random value this platform
 * issues as a credential (tokens, codes, keys) should come from one of
 * these rather than a one-off `crypto.randomBytes()` call scattered per
 * feature, so the *choice* of generator (always `node:crypto`, never
 * `Math.random()`) is enforced by what's convenient to reach for, not by
 * code review catching a mistake after the fact.
 */

/** A URL-safe random token of `byteLength` bytes of entropy (default 32 — matches `auth-service`'s existing link-token size). */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/** A zero-padded numeric code of `digits` length (default 6), cryptographically random — for OTP-style codes. */
export function generateNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, '0');
}

/** Raw random bytes, for callers that need the `Buffer` itself (e.g. a symmetric key) rather than an encoded string. */
export function generateRandomBytes(byteLength: number): Buffer {
  return randomBytes(byteLength);
}

/** A base32-encoded random secret (RFC 4648, no padding) — the shape a TOTP seed needs (`totp.service.ts`). */
export function generateBase32Secret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
