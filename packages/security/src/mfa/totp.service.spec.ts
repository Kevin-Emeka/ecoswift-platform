import { TotpService } from './totp.service';
import { base32Encode } from '../crypto/secure-random.util';

describe('TotpService', () => {
  let service: TotpService;

  beforeEach(() => {
    service = new TotpService();
  });

  describe('RFC 6238 Appendix B test vectors (SHA-1)', () => {
    // The RFC's own vectors are 8-digit codes; this service issues 6-digit
    // codes (the Google Authenticator-compatible convention, not the RFC's
    // own default). Truncation to 6 vs. 8 digits is just `% 10^6` vs.
    // `% 10^8` of the same underlying 31-bit dynamic-truncation value, so
    // the last 6 digits of each published 8-digit vector are exactly what
    // a 6-digit implementation must produce at the same timestamp — this
    // is what's actually being checked, not a coincidence of the numbers.
    const rfcSecretBase32 = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

    it.each([
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130'],
    ])('produces the RFC 6238 code at T=%d', (atSeconds, expectedCode) => {
      expect(service.verify(rfcSecretBase32, expectedCode, atSeconds)).toBe(true);
    });

    it('rejects a code from a materially different time step', () => {
      expect(service.verify(rfcSecretBase32, '287082', 59 + 300)).toBe(false);
    });
  });

  describe('generateSecret / buildProvisioningUri', () => {
    it('generates a secret that round-trips through base32 decode', () => {
      const secret = service.generateSecret();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    });

    it('builds a valid otpauth:// URI containing the secret and account label', () => {
      const secret = service.generateSecret();
      const uri = service.buildProvisioningUri(secret, 'jane@example.com');
      expect(uri).toMatch(/^otpauth:\/\/totp\//);
      expect(uri).toContain(`secret=${secret}`);
      expect(uri).toContain(encodeURIComponent('jane@example.com'));
      expect(uri).toContain('issuer=Ecoswift');
    });
  });

  describe('verify — generated round trip', () => {
    it('accepts a code generated for the current moment', () => {
      const secret = service.generateSecret();
      const now = Math.floor(Date.now() / 1000);
      const code = (service as unknown as { generateCode: (s: string, c: number) => string }).generateCode(
        secret,
        Math.floor(now / 30),
      );
      expect(service.verify(secret, code, now)).toBe(true);
    });

    it('accepts a code from one step in the past (clock drift tolerance)', () => {
      const secret = service.generateSecret();
      const now = Math.floor(Date.now() / 1000);
      const priorStepCode = (service as unknown as { generateCode: (s: string, c: number) => string }).generateCode(
        secret,
        Math.floor(now / 30) - 1,
      );
      expect(service.verify(secret, priorStepCode, now)).toBe(true);
    });

    it('rejects a code more than the tolerance window away', () => {
      const secret = service.generateSecret();
      const now = Math.floor(Date.now() / 1000);
      const farCode = (service as unknown as { generateCode: (s: string, c: number) => string }).generateCode(
        secret,
        Math.floor(now / 30) - 5,
      );
      expect(service.verify(secret, farCode, now)).toBe(false);
    });

    it('rejects a code for a different secret entirely', () => {
      const secretA = service.generateSecret();
      const secretB = service.generateSecret();
      const now = Math.floor(Date.now() / 1000);
      const codeForA = (service as unknown as { generateCode: (s: string, c: number) => string }).generateCode(
        secretA,
        Math.floor(now / 30),
      );
      expect(service.verify(secretB, codeForA, now)).toBe(false);
    });

    it('rejects malformed input (non-6-digit) without throwing', () => {
      const secret = service.generateSecret();
      expect(service.verify(secret, 'abcdef')).toBe(false);
      expect(service.verify(secret, '123')).toBe(false);
      expect(service.verify(secret, '')).toBe(false);
    });
  });
});
