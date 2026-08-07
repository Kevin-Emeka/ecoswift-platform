import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Records `http_request_duration_seconds`/`http_requests_total` for every
 * request. Uses the matched route path (`/v1/accounts/:id`), not the raw
 * URL (`/v1/accounts/9f2c...`) — using the raw URL would create a new,
 * ever-growing label series per unique resource id, which is the single
 * most common way to accidentally blow up Prometheus cardinality.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const route = request.route?.path ?? request.path ?? 'unknown';
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = {
          method: request.method,
          route,
          status_code: String(response.statusCode),
        };

        this.metrics.httpRequestDuration.observe(labels, durationSeconds);
        this.metrics.httpRequestsTotal.inc(labels);
      }),
    );
  }
}
