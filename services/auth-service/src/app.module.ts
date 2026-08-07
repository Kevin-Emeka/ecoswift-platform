import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@ecoswift/cache';
import { ResilienceModule } from '@ecoswift/resilience';
import { EventBusModule } from '@ecoswift/event-bus';
import { QueueModule } from '@ecoswift/queue';
import { ConfigurationModule } from '@ecoswift/config';
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
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { SecurityModule } from './modules/security/security.module';
import { MfaModule } from './modules/mfa/mfa.module';
import { ReferenceDataModule } from './modules/reference-data/reference-data.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    // Global infra modules — order matters, see docs/infrastructure.md §
    // Composition Rule: CacheModule provides REDIS_CLIENT, which
    // ResilienceModule/EventBusModule/QueueModule/ConfigurationModule/
    // RateLimitModule all depend on.
    CacheModule.forRoot(),
    ResilienceModule,
    EventBusModule.forRoot(),
    QueueModule.forRoot(),
    ConfigurationModule,
    MetricsModule,
    // Phase 3C § Progressive Rate Limiting: `strict` is a second, named
    // tier layered on top of `default` — generous globally (30/min, so it
    // doesn't restrict anything by default) and tightened per-route via
    // `@Throttle({ strict: { limit: 30, ttl: 60_000 } })` on the
    // credential-guessing-prone routes (`login`, `register`,
    // `forgot-password` — see `auth.controller.ts`). A request is blocked
    // the instant *either* tier's limit is hit. 30/min per IP is a third of
    // the global default, deliberately not lower: this tier only needs to
    // stop *automated* credential-stuffing volume, not every legitimate
    // burst — a single account's real lockout policy (`authentication.md`,
    // 5 failed attempts) is what actually protects one specific account,
    // and a shared-IP source (office NAT, a test suite hitting `/login`
    // repeatedly across many scenarios) must not be false-positived by the
    // network-level tier doing that job's work for it.
    RateLimitModule.forRoot({
      ttlMs: 60_000,
      limit: 100,
      blockDurationMs: 60_000,
      additionalTiers: [{ name: 'strict', ttlMs: 60_000, limit: 30, blockDurationMs: 60_000 }],
    }),
    LoggerModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    AuthorizationModule,
    SecurityModule,
    MfaModule,
    ReferenceDataModule,
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
