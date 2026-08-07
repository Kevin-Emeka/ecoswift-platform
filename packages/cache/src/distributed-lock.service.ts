import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

export interface LockOptions {
  /** How long the lock is held before it auto-expires, in milliseconds. */
  ttlMs?: number;
  /** How many times to retry acquiring before giving up. */
  retries?: number;
  /** Delay between acquire attempts, in milliseconds. */
  retryDelayMs?: number;
}

export interface AcquiredLock {
  key: string;
  token: string;
}

/**
 * Redis-backed distributed lock (`SET key token NX PX ttl`, release via a
 * compare-and-delete Lua script so a process can never release a lock it no
 * longer holds — e.g. after its own lock expired and someone else acquired
 * it in the meantime).
 *
 * This is a single-quorum lock (correct against one Redis primary or one
 * Cluster, which is what `@ecoswift/cache` targets) — not the multi-primary
 * Redlock algorithm, which solves a different problem (surviving a single
 * Redis node's total failure without ever double-granting a lock) that
 * doesn't apply to a Cluster-backed single logical dataset. If Ecoswift Bank
 * ever runs multiple independent Redis primaries specifically for locking
 * quorum, upgrade to the `redlock` package's algorithm at that point rather
 * than before there's a deployment topology that needs it.
 */
@Injectable()
export class DistributedLockService {
  private static readonly RELEASE_SCRIPT = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster) {}

  async acquire(key: string, options: LockOptions = {}): Promise<AcquiredLock | undefined> {
    const ttlMs = options.ttlMs ?? 30_000;
    const retries = options.retries ?? 0;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const token = randomUUID();

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return { key, token };
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return undefined;
  }

  async release(lock: AcquiredLock): Promise<boolean> {
    const result = await this.redis.eval(
      DistributedLockService.RELEASE_SCRIPT,
      1,
      lock.key,
      lock.token,
    );
    return result === 1;
  }

  /**
   * Acquire `key`, run `fn`, and always release afterward — the shape most
   * callers actually want (e.g. "only one worker should run month-end
   * interest posting at a time").
   */
  async withLock<T>(key: string, fn: () => Promise<T>, options: LockOptions = {}): Promise<T> {
    const lock = await this.acquire(key, options);
    if (!lock) {
      throw new Error(`Could not acquire lock "${key}" — held by another process`);
    }

    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }
}
