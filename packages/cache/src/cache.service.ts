import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

export interface CacheSetOptions {
  /** Time-to-live in seconds. Omit for no expiry (rare — prefer always setting one). */
  ttlSeconds?: number;
}

/**
 * Cache-aside helper over the shared Redis client. Callers are expected to
 * treat everything read through here as a cache of a real source of truth
 * elsewhere (Postgres, another service) — never the source of truth itself,
 * per the same principle the ledger's `AccountBalance` projection follows.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const serialized = JSON.stringify(value);
    if (options.ttlSeconds) {
      await this.redis.set(key, serialized, 'EX', options.ttlSeconds);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Deletes every key matching `prefix*`. In Cluster mode, `SCAN` is a
   * per-node operation (a cluster has no single keyspace to scan) — ioredis
   * doesn't expose `scanStream()` on `Cluster` directly, so this scans each
   * master shard independently, per ioredis's documented Cluster pattern.
   */
  async delByPrefix(prefix: string): Promise<void> {
    const nodes = this.isCluster(this.redis) ? this.redis.nodes('master') : [this.redis];

    for (const node of nodes) {
      const stream = node.scanStream({ match: `${prefix}*`, count: 100 });
      const pipeline = this.redis.pipeline();
      let queued = 0;

      for await (const keys of stream as AsyncIterable<string[]>) {
        for (const key of keys) {
          pipeline.del(key);
          queued += 1;
        }
      }

      if (queued > 0) {
        await pipeline.exec();
      }
    }
  }

  private isCluster(client: Redis | Cluster): client is Cluster {
    return typeof (client as Cluster).nodes === 'function';
  }

  /**
   * Cache-aside read-through: return the cached value if present, otherwise
   * compute it via `loader`, cache the result, and return it. This is the
   * primary way application code should touch the cache — direct get/set
   * calls invite forgetting one half of the pair.
   */
  async wrap<T>(key: string, loader: () => Promise<T>, options: CacheSetOptions = {}): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await loader();
    try {
      await this.set(key, value, options);
    } catch (error) {
      // A cache write failure should never fail the caller's request — the
      // value they asked for is still valid, it just won't be cached.
      this.logger.warn(`Failed to write cache key "${key}": ${(error as Error).message}`);
    }
    return value;
  }
}
