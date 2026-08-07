import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { CacheService } from '@ecoswift/cache';

const CACHE_PREFIX = 'config:flag:';
const CACHE_TTL_SECONDS = 30;

export interface FeatureFlagContext {
  /** The subject the flag is being evaluated for — a customer or staff id, used both for scope matching and deterministic rollout bucketing. */
  subjectId?: string;
}

/**
 * Evaluates `FeatureFlag` rows (`prisma/schema.prisma`). Rollout bucketing
 * is **deterministic** per `(flagKey, subjectId)` — the same customer gets
 * the same on/off result on every request rather than a coin-flip per call,
 * which is what makes a gradual rollout percentage meaningful instead of a
 * flickering experience.
 */
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async isEnabled(key: string, context: FeatureFlagContext = {}): Promise<boolean> {
    const flag = await this.cache.wrap(
      `${CACHE_PREFIX}${key}`,
      () => this.prisma.featureFlag.findUnique({ where: { key } }),
      { ttlSeconds: CACHE_TTL_SECONDS },
    );

    if (!flag || !flag.isEnabled) {
      return false;
    }

    if (flag.scope !== 'GLOBAL' && flag.scopeReference && flag.scopeReference !== context.subjectId) {
      return false;
    }

    if (flag.rolloutPercentage === null || flag.rolloutPercentage === undefined) {
      return true;
    }

    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;

    const bucket = this.bucketFor(key, context.subjectId ?? 'anonymous');
    return bucket < flag.rolloutPercentage;
  }

  /** Invalidates the cached value immediately — call after writing a flag (Phase 3B's `FeatureFlagAdminService`), rather than waiting out the TTL, same as `ConfigurationService.invalidate()`. */
  async invalidate(key: string): Promise<void> {
    await this.cache.del(`${CACHE_PREFIX}${key}`);
  }

  /** Maps `(flagKey, subjectId)` to a stable integer in [0, 100). */
  private bucketFor(flagKey: string, subjectId: string): number {
    const hash = createHash('sha256').update(`${flagKey}:${subjectId}`).digest();
    return hash.readUInt32BE(0) % 100;
  }
}
