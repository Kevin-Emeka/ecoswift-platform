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
import { CorrelationIdMiddleware, RequestIdMiddleware, MetricsModule, HttpMetricsInterceptor } from '@ecoswift/observability';
import { RateLimitModule } from '@ecoswift/http';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SmsModule } from './modules/sms/sms.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

/** A pure background worker plus a health endpoint — no user-facing HTTP API, same shape as email-service. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    CacheModule.forRoot(),
    ResilienceModule,
    EventBusModule.forRoot(),
    QueueModule.forRoot(),
    ConfigurationModule,
    MetricsModule,
    RateLimitModule.forRoot({ ttlMs: 60_000, limit: 100, blockDurationMs: 60_000 }),
    LoggerModule,
    DatabaseModule,
    HealthModule,
    SmsModule,
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
    consumer.apply(CorrelationIdMiddleware, RequestIdMiddleware).forRoutes('*');
  }
}
