import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@ecoswift/database';
import { ConfigurationService } from '@ecoswift/config';
import { AUTH_DEFAULTS } from '../constants/auth.constants';

export interface PasswordPolicyViolation {
  rule: string;
  message: string;
}

/**
 * Argon2id password hashing (security-model.md § Password Lifecycle:
 * "salted, adaptive one-way hash... the plaintext never persists anywhere").
 * Argon2id is used rather than bcrypt — it's the OWASP-recommended default
 * for new systems (resistant to both GPU-cracking and side-channel attacks,
 * where bcrypt is vulnerable to the former and scrypt-style algorithms to
 * the latter) and there's no legacy-compatibility reason here to prefer
 * bcrypt, since this is a new system with no existing bcrypt hashes to
 * migrate.
 *
 * Parameters follow OWASP's current Argon2id guidance for a
 * general-purpose, non-hardware-backed server (19 MiB memory, 2 iterations,
 * 1 degree of parallelism) — deliberately conservative so hashing stays
 * fast enough not to become its own denial-of-service vector under login
 * load, while remaining meaningfully more expensive to brute-force than an
 * unsalted or fast hash.
 */
@Injectable()
export class PasswordService {
  private static readonly ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configurationService: ConfigurationService,
  ) {}

  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, PasswordService.ARGON2_OPTIONS);
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // A malformed/foreign hash format throws rather than returning false —
      // treat it as "does not match" rather than letting the error surface.
      return false;
    }
  }

  /**
   * Structural policy: length + character-class complexity. Thresholds are
   * read from `ApplicationSetting` (business-rules.md § Password Policy —
   * "sourced from Configuration so it can be strengthened without a
   * deploy"), falling back to `AUTH_DEFAULTS` if unset.
   */
  async validateComplexity(plaintext: string): Promise<PasswordPolicyViolation[]> {
    const violations: PasswordPolicyViolation[] = [];

    const minLength = await this.configurationService.getNumber(
      'password.min_length',
      AUTH_DEFAULTS.passwordMinLength,
    );
    const requireUppercase = await this.configurationService.getBoolean('password.require_uppercase', true);
    const requireLowercase = await this.configurationService.getBoolean('password.require_lowercase', true);
    const requireNumber = await this.configurationService.getBoolean('password.require_number', true);
    const requireSymbol = await this.configurationService.getBoolean('password.require_symbol', true);

    if (plaintext.length < minLength) {
      violations.push({ rule: 'min_length', message: `Password must be at least ${minLength} characters` });
    }
    if (requireUppercase && !/[A-Z]/.test(plaintext)) {
      violations.push({ rule: 'uppercase', message: 'Password must contain at least one uppercase letter' });
    }
    if (requireLowercase && !/[a-z]/.test(plaintext)) {
      violations.push({ rule: 'lowercase', message: 'Password must contain at least one lowercase letter' });
    }
    if (requireNumber && !/[0-9]/.test(plaintext)) {
      violations.push({ rule: 'number', message: 'Password must contain at least one number' });
    }
    if (requireSymbol && !/[^A-Za-z0-9]/.test(plaintext)) {
      violations.push({ rule: 'symbol', message: 'Password must contain at least one special character' });
    }

    return violations;
  }

  /**
   * `PasswordRotationPolicy` (business-rules.md): a new password must not
   * match any of the user's last N passwords. Compares against Argon2
   * hashes one at a time (never store/compare plaintext) — necessarily
   * sequential since Argon2 verification has no equality shortcut.
   */
  async isReusedPassword(userId: string, plaintext: string): Promise<boolean> {
    const historyCount = await this.configurationService.getNumber(
      'password.history_count',
      AUTH_DEFAULTS.passwordHistoryCount,
    );
    if (historyCount <= 0) return false;

    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: historyCount,
      select: { passwordHash: true },
    });

    for (const entry of history) {
      if (await this.verify(entry.passwordHash, plaintext)) {
        return true;
      }
    }
    return false;
  }

  /** Records a newly-set password hash in history and prunes anything beyond the retention window. */
  async recordPasswordHistory(userId: string, passwordHash: string): Promise<void> {
    const historyCount = await this.configurationService.getNumber(
      'password.history_count',
      AUTH_DEFAULTS.passwordHistoryCount,
    );

    await this.prisma.passwordHistory.create({ data: { userId, passwordHash } });

    const excess = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: historyCount,
      select: { id: true },
    });
    if (excess.length > 0) {
      await this.prisma.passwordHistory.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
    }
  }
}
