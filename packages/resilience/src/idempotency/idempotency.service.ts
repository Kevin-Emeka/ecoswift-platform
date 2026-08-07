import { Inject, Injectable } from '@nestjs/common';
import { CacheService, REDIS_CLIENT } from '@ecoswift/cache';
import type { Cluster, Redis } from 'ioredis';

export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`A request with idempotency key "${key}" is already being processed`);
    this.name = 'IdempotencyConflictError';
  }
}

export interface IdempotencyOptions {
  /** How long a completed result is remembered and replayed, in seconds. */
  resultTtlSeconds?: number;
  /** How long an in-progress marker is held before it's assumed abandoned, in seconds. */
  inProgressTtlSeconds?: number;
  /** How long to wait, polling, for a concurrent in-flight request to finish before giving up. */
  waitForInFlightMs?: number;
}

const IDEMPOTENCY_PREFIX = 'idempotency:';
const IN_PROGRESS_MARKER = '__IN_PROGRESS__';

/**
 * Redis-backed idempotency: the database implementation of `api-guidelines.md`'s
 * idempotency-key requirement on mutating endpoints like `POST /transfers`
 * (business-rules.md § Transfer Validation — "did my transfer double-post
 * because of a retry" is not an acceptable failure mode for a bank).
 *
 * Three outcomes for a given key:
 *   1. Never seen before → run `fn`, cache and return the result.
 *   2. Already completed → return the cached result without re-running `fn`.
 *   3. Currently in flight (a concurrent duplicate) → wait briefly for it to
 *      finish and return that result, or throw `IdempotencyConflictError`.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly cache: CacheService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster,
  ) {}

  async execute<T>(
    idempotencyKey: string,
    fn: () => Promise<T>,
    options: IdempotencyOptions = {},
  ): Promise<T> {
    const {
      resultTtlSeconds = 24 * 60 * 60,
      inProgressTtlSeconds = 60,
      waitForInFlightMs = 5000,
    } = options;
    const key = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;

    const claimed = await this.redis.set(key, IN_PROGRESS_MARKER, 'EX', inProgressTtlSeconds, 'NX');

    if (claimed !== 'OK') {
      // Someone else already holds this key — either they finished (a
      // cached result is sitting there) or they're still working on it.
      return this.waitForResult<T>(key, waitForInFlightMs, idempotencyKey);
    }

    try {
      const result = await fn();
      await this.cache.set(key, result, { ttlSeconds: resultTtlSeconds });
      return result;
    } catch (error) {
      // Don't let a failed attempt permanently block retries under the same
      // key — release the claim so the next attempt can run cleanly.
      await this.cache.del(key);
      throw error;
    }
  }

  private async waitForResult<T>(key: string, waitMs: number, originalKey: string): Promise<T> {
    const pollIntervalMs = 100;
    const deadline = Date.now() + waitMs;

    while (Date.now() < deadline) {
      const value = await this.cache.get<T | typeof IN_PROGRESS_MARKER>(key);
      if (value !== undefined && value !== IN_PROGRESS_MARKER) {
        return value as T;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new IdempotencyConflictError(originalKey);
  }
}
