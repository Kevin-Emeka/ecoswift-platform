import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@ecoswift/cache';
import { ResilienceModule } from '@ecoswift/resilience';
import { ConfigurationModule } from '@ecoswift/config';
import { AuthzModule } from '@ecoswift/authz';
import { AuthClientModule } from '@ecoswift/auth-client';
import {
  CorrelationIdMiddleware,
  RequestIdMiddleware,
  MetricsModule,
  HttpMetricsInterceptor,
} from '@ecoswift/observability';
import { RateLimitModule, RequestContextMiddleware } from '@ecoswift/http';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

/**
 * audit-service is a read-only query surface over the shared `AuditLog`
 * table (see `AuditQueryService`'s doc comment) — no `EventBusModule`,
 * no `QueueModule`, since it neither publishes domain events nor consumes
 * any queue.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    CacheModule.forRoot(),
    ResilienceModule,
    ConfigurationModule,
    AuthzModule,
    AuthClientModule,
    MetricsModule,
    RateLimitModule.forRoot({ ttlMs: 60_000, limit: 100, blockDurationMs: 60_000 }),
    LoggerModule,
    DatabaseModule,
    HealthModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, RequestIdMiddleware, RequestContextMiddleware)
      .forRoutes('*');
  }
}
