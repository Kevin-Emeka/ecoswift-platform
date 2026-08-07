import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT } from '@ecoswift/cache';

/**
 * Redis-backed `ThrottlerStorage`, replacing `@nestjs/throttler`'s default
 * in-memory storage. This matters at "millions of users" scale for one
 * concrete reason: in-memory storage counts hits **per process**. Run 3
 * instances of `apps/api` behind a load balancer with the default storage
 * and a "100 requests/minute" limit is actually a 300-requests/minute limit
 * in aggregate, silently, because each instance has its own counter. This
 * adapter makes the limit real across however many instances are running.
 *
 * Implements the exact same semantics as `ThrottlerStorageService`
 * (`@nestjs/throttler`'s default), verified against that class's source:
 * `ttl`/`blockDuration` arguments are milliseconds, `timeToExpire`/
 * `timeToBlockExpire` are returned in seconds, and hits don't keep
 * incrementing once a key is blocked.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private static readonly SCRIPT = `
    local key = KEYS[1]
    local ttlMs = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local blockDurationMs = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])

    local blockedUntil = tonumber(redis.call('HGET', key, 'blockedUntil') or '0')

    if blockedUntil > now then
      local hits = tonumber(redis.call('HGET', key, 'hits') or '0')
      local pttl = redis.call('PTTL', key)
      if pttl < 0 then pttl = blockDurationMs end
      return { hits, math.ceil(pttl / 1000), 1, math.ceil((blockedUntil - now) / 1000) }
    end

    if blockedUntil ~= 0 then
      redis.call('HSET', key, 'hits', 0, 'blockedUntil', 0)
    end

    local hits = redis.call('HINCRBY', key, 'hits', 1)
    local pttl = redis.call('PTTL', key)
    if pttl < 0 then
      redis.call('PEXPIRE', key, ttlMs)
      pttl = ttlMs
    end

    local isBlocked = 0
    local timeToBlockExpire = 0
    if hits > limit then
      local newBlockedUntil = now + blockDurationMs
      redis.call('HSET', key, 'blockedUntil', newBlockedUntil)
      redis.call('PEXPIRE', key, blockDurationMs)
      isBlocked = 1
      timeToBlockExpire = math.ceil(blockDurationMs / 1000)
      pttl = blockDurationMs
    end

    return { hits, math.ceil(pttl / 1000), isBlocked, timeToBlockExpire }
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const storageKey = `throttle:${throttlerName}:${key}`;
    const result = (await this.redis.eval(
      RedisThrottlerStorage.SCRIPT,
      1,
      storageKey,
      ttl,
      limit,
      blockDuration,
      Date.now(),
    )) as [number, number, number, number];

    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = result;
    return {
      totalHits,
      timeToExpire,
      isBlocked: isBlocked === 1,
      timeToBlockExpire,
    };
  }
}
