import { randomBytes } from 'node:crypto';
import { EncryptionService } from './encryption.service';
import type { ConfigService } from '@nestjs/config';

function makeConfig(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

describe('EncryptionService', () => {
  const currentKey = randomBytes(32).toString('base64');
  const previousKey = randomBytes(32).toString('base64');

  it('throws on module init when ENCRYPTION_KEY is not configured', () => {
    const service = new EncryptionService(makeConfig({}));
    expect(() => service.onModuleInit()).toThrow(/ENCRYPTION_KEY is not configured/);
  });

  it('throws when the configured key does not decode to exactly 32 bytes', () => {
    const service = new EncryptionService(makeConfig({ 'encryption.key': Buffer.from('too-short').toString('base64') }));
    expect(() => service.onModuleInit()).toThrow(/must decode to exactly 32 bytes/);
  });

  describe('encrypt / decrypt', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(makeConfig({ 'encryption.key': currentKey }));
      service.onModuleInit();
    });

    it('round-trips plaintext through encrypt then decrypt', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP'; // a TOTP-secret-shaped value
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it('never emits the plaintext as a substring of the ciphertext', () => {
      const plaintext = 'super-secret-totp-seed';
      const ciphertext = service.encrypt(plaintext);
      expect(ciphertext).not.toContain(plaintext);
    });

    it('produces a different ciphertext for the same plaintext on each call (random IV)', () => {
      const plaintext = 'same input twice';
      expect(service.encrypt(plaintext)).not.toBe(service.encrypt(plaintext));
    });

    it('embeds an 8-hex-char key id derived from the key material, as the first colon-delimited segment', () => {
      const ciphertext = service.encrypt('x');
      const [keyId] = ciphertext.split(':');
      expect(keyId).toMatch(/^[0-9a-f]{8}$/);
    });

    it('rejects a malformed envelope', () => {
      expect(() => service.decrypt('not-a-valid-envelope')).toThrow('Malformed encryption envelope');
    });

    // Flips a character solidly in the *middle* of a base64 segment, not
    // the last character — base64's final character(s) sit at a padding
    // boundary where a single-character edit can decode to the same
    // trailing byte(s) it started as, understating what actually changed.
    // A middle-character flip unambiguously changes a real byte.
    function flipMiddleChar(base64: string): string {
      const index = Math.floor(base64.length / 2);
      const char = base64[index]!;
      const replacement = char === 'A' ? 'B' : 'A';
      return base64.slice(0, index) + replacement + base64.slice(index + 1);
    }

    it('rejects a tampered ciphertext (GCM auth tag catches it)', () => {
      const ciphertext = service.encrypt('authentic data of meaningful length');
      const parts = ciphertext.split(':');
      const tampered = [...parts];
      tampered[3] = flipMiddleChar(tampered[3]!);
      expect(() => service.decrypt(tampered.join(':'))).toThrow();
    });

    it('rejects a tampered auth tag', () => {
      const ciphertext = service.encrypt('authentic data');
      const parts = ciphertext.split(':');
      const tampered = [...parts];
      tampered[2] = flipMiddleChar(tampered[2]!);
      expect(() => service.decrypt(tampered.join(':'))).toThrow();
    });
  });

  describe('key rotation', () => {
    it('decrypts data encrypted under the previous key during the grace period', () => {
      const oldService = new EncryptionService(makeConfig({ 'encryption.key': previousKey }));
      oldService.onModuleInit();
      const ciphertext = oldService.encrypt('data from before rotation');

      const rotatedService = new EncryptionService(
        makeConfig({ 'encryption.key': currentKey, 'encryption.previousKey': previousKey }),
      );
      rotatedService.onModuleInit();

      expect(rotatedService.decrypt(ciphertext)).toBe('data from before rotation');
    });

    it('encrypts new data under the current key, not the previous one', () => {
      const rotatedService = new EncryptionService(
        makeConfig({ 'encryption.key': currentKey, 'encryption.previousKey': previousKey }),
      );
      rotatedService.onModuleInit();

      const ciphertext = rotatedService.encrypt('new data');
      const onlyCurrentKeyService = new EncryptionService(makeConfig({ 'encryption.key': currentKey }));
      onlyCurrentKeyService.onModuleInit();

      expect(onlyCurrentKeyService.decrypt(ciphertext)).toBe('new data');
    });

    it('fails to decrypt data under a key that is neither current nor previous', () => {
      const strangerService = new EncryptionService(makeConfig({ 'encryption.key': randomBytes(32).toString('base64') }));
      strangerService.onModuleInit();
      const ciphertext = strangerService.encrypt('stranger data');

      const rotatedService = new EncryptionService(
        makeConfig({ 'encryption.key': currentKey, 'encryption.previousKey': previousKey }),
      );
      rotatedService.onModuleInit();

      expect(() => rotatedService.decrypt(ciphertext)).toThrow(/No configured encryption key matches/);
    });
  });
});
