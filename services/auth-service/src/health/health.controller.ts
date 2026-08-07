import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '@ecoswift/database';
import { RedisHealthIndicator } from '@ecoswift/observability';
import { Public } from '../common/decorators/public.decorator';

/**
 * Same liveness/readiness split as apps/api — see docs/observability.md.
 * `@Public()` on every route here: the auth module's `JwtAuthGuard` is
 * registered app-wide, and an orchestrator's liveness/readiness probe must
 * never itself require a valid access token to answer.
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

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.prismaService),
      () => this.redis.pingCheck('redis'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }

  @Public()
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024)]);
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.prismaService),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
