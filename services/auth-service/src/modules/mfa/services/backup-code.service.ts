import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { generateSecureToken } from '@ecoswift/security';
import { AUTH_DEFAULTS } from '../../auth/constants/auth.constants';

const CODE_BYTES = 5; // 5 random bytes -> 8-char base32-ish token via base64url, plenty of entropy for a single-use recovery code

/**
 * Single-use MFA recovery codes (`BackupCode`, Phase 2B schema) — the "I
 * lost my phone" escape hatch every MFA implementation needs, so losing a
 * TOTP device doesn't permanently lock someone out of their own account.
 * Only the SHA-256 hash of each code is ever persisted (same
 * never-store-the-secret pattern as everywhere else in this service);
 * codes are shown to the user exactly once, at generation time.
 */
@Injectable()
export class BackupCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(twoFactorCredentialId: string, count: number = AUTH_DEFAULTS.backupCodeCount): Promise<string[]> {
    const codes = Array.from({ length: count }, () => this.formatCode(generateSecureToken(CODE_BYTES)));

    await this.prisma.backupCode.createMany({
      data: codes.map((code) => ({ twoFactorCredentialId, codeHash: this.hash(code) })),
    });

    return codes;
  }

  /** Invalidates every unused code for this credential — call before `generate()` on a regenerate so old codes stop working the instant new ones are issued. */
  async invalidateAll(twoFactorCredentialId: string): Promise<void> {
    await this.prisma.backupCode.deleteMany({ where: { twoFactorCredentialId, usedAt: null } });
  }

  /** Marks a code used and returns `true` — or returns `false` for an unknown or already-used code. A backup code is exactly one login's worth of recovery, never reusable. */
  async consume(twoFactorCredentialId: string, code: string): Promise<boolean> {
    const codeHash = this.hash(this.normalize(code));
    const record = await this.prisma.backupCode.findFirst({
      where: { twoFactorCredentialId, codeHash, usedAt: null },
    });
    if (!record) return false;

    await this.prisma.backupCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return true;
  }

  async remainingCount(twoFactorCredentialId: string): Promise<number> {
    return this.prisma.backupCode.count({ where: { twoFactorCredentialId, usedAt: null } });
  }

  private formatCode(raw: string): string {
    // Group into a human-typeable "xxxx-xxxx"-shaped code rather than a raw base64url blob.
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const padded = cleaned.padEnd(8, '0').slice(0, 8);
    return `${padded.slice(0, 4)}-${padded.slice(4, 8)}`;
  }

  private normalize(code: string): string {
    return code.trim().toUpperCase();
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
