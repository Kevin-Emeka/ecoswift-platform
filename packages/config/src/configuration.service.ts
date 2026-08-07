import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { CacheService } from '@ecoswift/cache';

const CACHE_PREFIX = 'config:setting:';
const CACHE_TTL_SECONDS = 60;

/**
 * Reads `ApplicationSetting`/`SystemSetting` rows (`prisma/schema.prisma`,
 * Phase 2B) — the runtime-editable configuration store `domain-architecture.md`
 * § Configuration describes ("a runtime, staff-editable configuration store
 * is a new capability introduced in this phase's design, realized in Phase
 * 2B/3"). This is that realization: business/product values (transfer
 * limits, password policy, maker-checker thresholds — see the values
 * `prisma/seed.ts` seeds) live in the database, not in `.env`, so changing
 * them is a maker-checker-approved data change, not a deploy.
 *
 * Cached with a short TTL (not indefinitely) so a change made via the admin
 * app is picked up by every running instance within `CACHE_TTL_SECONDS`
 * without needing a restart or a cache-invalidation event bus round-trip —
 * a deliberately simple trade-off for this phase; event-driven invalidation
 * (on `ConfigurationChanged`, `domain-architecture.md`) is a documented
 * future enhancement, not implemented here to avoid this package depending
 * on `@ecoswift/event-bus` for a TTL that's already short enough to be safe.
 */
@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSetting(key: string): Promise<string | undefined> {
    return this.cache.wrap(
      `${CACHE_PREFIX}${key}`,
      async () => {
        const setting = await this.prisma.applicationSetting.findUnique({ where: { key } });
        return setting?.value;
      },
      { ttlSeconds: CACHE_TTL_SECONDS },
    );
  }

  async getNumber(key: string, fallback?: number): Promise<number> {
    const raw = await this.getSetting(key);
    if (raw === undefined) {
      if (fallback !== undefined) return fallback;
      throw new Error(`Configuration key "${key}" is not set and no fallback was provided`);
    }
    const value = Number(raw);
    if (Number.isNaN(value)) {
      this.logger.warn(`Configuration key "${key}" is not numeric: "${raw}"`);
      if (fallback !== undefined) return fallback;
      throw new Error(`Configuration key "${key}" has a non-numeric value`);
    }
    return value;
  }

  async getBoolean(key: string, fallback = false): Promise<boolean> {
    const raw = await this.getSetting(key);
    if (raw === undefined) return fallback;
    return raw === 'true';
  }

  async getJson<T>(key: string, fallback?: T): Promise<T | undefined> {
    const raw = await this.getSetting(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Configuration key "${key}" is not valid JSON`);
      return fallback;
    }
  }

  /** Invalidates the cached value immediately — call after writing a new value, rather than waiting out the TTL. */
  async invalidate(key: string): Promise<void> {
    await this.cache.del(`${CACHE_PREFIX}${key}`);
  }
}
