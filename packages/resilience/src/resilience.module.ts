import { Module } from '@nestjs/common';
import { CircuitBreakerFactory } from './circuit-breaker/circuit-breaker.factory';
import { IdempotencyService } from './idempotency/idempotency.service';

/**
 * Provides `CircuitBreakerFactory` and `IdempotencyService`. `IdempotencyService`
 * depends on `@ecoswift/cache`'s `CacheService`/`REDIS_CLIENT` — import
 * `CacheModule.forRoot()` once in the app's `AppModule` (it's `@Global()`,
 * so this module deliberately does not re-import it itself, which would
 * risk a second Redis connection being created).
 */
@Module({
  providers: [CircuitBreakerFactory, IdempotencyService],
  exports: [CircuitBreakerFactory, IdempotencyService],
})
export class ResilienceModule {}
