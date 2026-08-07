import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * Wraps a single `prom-client` registry shared by every app/service. Default
 * Node.js process metrics (heap, event loop lag, GC, file descriptors) are
 * collected automatically; `httpRequestDuration`/`httpRequestsTotal` are the
 * two metrics `HttpMetricsInterceptor` records on every request.
 *
 * Scraped by `MetricsController`'s `/metrics` endpoint — see
 * docs/observability.md § Prometheus for the scrape config this pairs with.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new client.Registry();

  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  /** Phase 3C — every `SecurityEvent` write (`SecurityEventService`) also increments this, so security posture is watchable on a dashboard, not just queryable after the fact in Postgres. */
  readonly securityEventsTotal = new client.Counter({
    name: 'security_events_total',
    help: 'Total number of security events recorded, by event type',
    labelNames: ['event_type'],
    registers: [this.registry],
  });

  onModuleInit(): void {
    client.collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
