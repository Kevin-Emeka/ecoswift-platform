import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '@ecoswift/shared';
import { MetricsService } from './metrics.service';

/**
 * `GET /metrics` — Prometheus scrape target. Deliberately not versioned
 * (`/v1/...`) like the rest of the API (`api-guidelines.md`) — scrape
 * endpoints are an operational contract with Prometheus, not a public API
 * surface, and versioning it would just make every scrape config brittle
 * against Nest's app-level `enableVersioning` default.
 *
 * `@Public()`: any service that registers a global auth guard (e.g.
 * `auth-service`'s `JwtAuthGuard`, Phase 3A) must not accidentally require
 * a bearer token for Prometheus to scrape this endpoint.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.contentType);
    res.send(await this.metrics.getMetrics());
  }
}
