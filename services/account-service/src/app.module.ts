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
import { AuthzModule } from '@ecoswift/authz';
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
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { BeneficiariesModule } from './modules/beneficiaries/beneficiaries.module';
import { ScheduledTransfersModule } from './modules/scheduled-transfers/scheduled-transfers.module';
import { TransferReviewModule } from './modules/transfer-review/transfer-review.module';
import { TransferLimitsAdminModule } from './modules/transfer-limits-admin/transfer-limits-admin.module';
import { StaffModule } from './modules/staff/staff.module';
import { ReferenceDataModule } from './modules/reference-data/reference-data.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

/**
 * Same global-infra composition as auth-service (docs/infrastructure.md §
 * Composition Rule): `CacheModule` first (provides `REDIS_CLIENT`), then
 * everything that depends on it, then `ConfigurationModule`/`AuthzModule`
 * (not `@Global()`, imported explicitly per that doc's rule).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    CacheModule.forRoot(),
    ResilienceModule,
    EventBusModule.forRoot(),
    QueueModule.forRoot(),
    ConfigurationModule,
    AuthzModule,
    MetricsModule,
    RateLimitModule.forRoot({ ttlMs: 60_000, limit: 100, blockDurationMs: 60_000 }),
    LoggerModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    CustomersModule,
    AccountsModule,
    TransactionsModule,
    TransfersModule,
    BeneficiariesModule,
    ScheduledTransfersModule,
    TransferReviewModule,
    TransferLimitsAdminModule,
    StaffModule,
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
