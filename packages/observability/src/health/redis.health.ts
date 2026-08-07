import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT } from '@ecoswift/cache';

/**
 * Terminus health indicator for Redis, following the same class-based
 * `HealthIndicator` pattern Phase 1 already established for
 * `PrismaHealthIndicator`/`MemoryHealthIndicator` (see e.g.
 * `apps/api/src/health/health.controller.ts`) — plugs into the same
 * `HealthCheckService.check([...])` array so `/health` reports every
 * dependency through one consistent contract.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster) {
    super();
  }

  async pingCheck(key = 'redis'): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      const isHealthy = pong === 'PONG';
      const result = this.getStatus(key, isHealthy);
      if (!isHealthy) {
        throw new HealthCheckError('Redis check failed', result);
      }
      return result;
    } catch (error) {
      if (error instanceof HealthCheckError) throw error;
      const result = this.getStatus(key, false, { message: (error as Error).message });
      throw new HealthCheckError('Redis check failed', result);
    }
  }
}
