import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '@ecoswift/database';
import { RedisHealthIndicator } from '@ecoswift/observability';

/**
 * Three distinct checks, matching Kubernetes-style probe conventions
 * (Phase 2C brief: Health Check Service + separate readiness/liveness
 * probes — these aren't the same question):
 *
 * - `/health` — full status, for humans/dashboards: every dependency.
 * - `/health/live` — **liveness**: is this process itself still
 *   responsive? No external dependency checks — a database outage should
 *   never cause Kubernetes to kill and restart a perfectly healthy pod
 *   that's correctly reporting "I can't reach the database" (that's what
 *   *readiness* failing is for). Liveness failing means "restart me,"
 *   which a downstream outage doesn't warrant.
 * - `/health/ready` — **readiness**: can this instance actually serve
 *   traffic right now? Checks the dependencies that matter for serving
 *   requests (database, cache). Failing readiness means "stop routing
 *   traffic here," not "restart me."
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaHealthIndicator,
    private readonly prismaService: PrismaService,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.prismaService),
      () => this.redis.pingCheck('redis'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }

  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024)]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.prismaService),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
