import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit IV — the GCM-recommended size, not the 16-byte CBC default.
const KEY_LENGTH_BYTES = 32; // AES-256
const KEY_ID_LENGTH_HEX = 8;

interface KeyRingEntry {
  id: string;
  key: Buffer;
}

/**
 * Envelope encryption for at-rest sensitive fields (security-model.md §
 * Encryption Boundaries — "field-level encryption for the highest-
 * sensitivity fields"; this phase's concrete instance is
 * `TwoFactorCredential.secretEncrypted`, the TOTP seed, seeded as a column
 * name in Phase 2B and left unencrypted until now). AES-256-GCM: an
 * authenticated mode, so a tampered ciphertext fails to decrypt rather than
 * silently returning corrupted plaintext.
 *
 * ## Key Rotation Strategy
 *
 * Every ciphertext embeds an 8-hex-character key id — the first 8 hex
 * characters of SHA-256(key) — computed from the *key material itself*,
 * not a version counter someone has to remember to bump. Rotating is:
 * generate a new random 32-byte key, set it as `ENCRYPTION_KEY`, move the
 * old value to `ENCRYPTION_KEY_PREVIOUS`. From that moment: `encrypt()`
 * only ever uses the current key; `decrypt()` tries the current key's id
 * first, falls back to the previous key's id, and throws if neither
 * matches — so data encrypted under the old key keeps decrypting
 * throughout the grace period without any migration step, and a ciphertext
 * that matches neither configured key fails loudly rather than silently.
 * There is intentionally no support for more than two live keys at once —
 * finish re-encrypting under the new key (a background job outside this
 * service's scope) before rotating again.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private currentKey!: KeyRingEntry;
  private previousKey: KeyRingEntry | undefined;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const currentRaw = this.configService.get<string>('encryption.key');
    if (!currentRaw) {
      throw new Error(
        'ENCRYPTION_KEY is not configured — required for @ecoswift/security\'s EncryptionService. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      );
    }
    this.currentKey = this.loadKey(currentRaw, 'ENCRYPTION_KEY');

    const previousRaw = this.configService.get<string>('encryption.previousKey');
    this.previousKey = previousRaw ? this.loadKey(previousRaw, 'ENCRYPTION_KEY_PREVIOUS') : undefined;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.currentKey.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [this.currentKey.id, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  decrypt(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 4) {
      throw new Error('Malformed encryption envelope');
    }
    const [keyId, ivB64, authTagB64, ciphertextB64] = parts as [string, string, string, string];

    const key = this.resolveKeyById(keyId);
    if (!key) {
      throw new Error('No configured encryption key matches this ciphertext\'s key id — cannot decrypt');
    }

    const decipher = createDecipheriv(ALGORITHM, key.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  }

  private resolveKeyById(keyId: string): KeyRingEntry | undefined {
    if (this.currentKey.id === keyId) return this.currentKey;
    if (this.previousKey?.id === keyId) return this.previousKey;
    return undefined;
  }

  private loadKey(base64Key: string, sourceName: string): KeyRingEntry {
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(`${sourceName} must decode to exactly ${KEY_LENGTH_BYTES} bytes (got ${key.length}) — expected a base64-encoded AES-256 key`);
    }
    const id = createHash('sha256').update(key).digest('hex').slice(0, KEY_ID_LENGTH_HEX);
    return { id, key };
  }
}
