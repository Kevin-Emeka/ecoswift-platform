import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

/**
 * Provides `MetricsService` (the shared prom-client registry),
 * `MetricsController` (`GET /metrics`), and `HttpMetricsInterceptor`. The
 * interceptor is exported, not auto-registered as a global `APP_INTERCEPTOR`
 * here — each app registers it alongside its existing `LoggingInterceptor`
 * (Phase 1) in its own `AppModule`, so interceptor ordering stays visible
 * and explicit in the one place that already owns it, rather than a shared
 * package silently inserting itself into the chain.
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, HttpMetricsInterceptor],
  exports: [MetricsService, HttpMetricsInterceptor],
})
export class MetricsModule {}
