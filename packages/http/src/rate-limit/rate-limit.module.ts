import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ThrottlerModule, type ThrottlerOptions } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-throttler-storage';

export interface RateLimitOptions {
  /** Window, in milliseconds. */
  ttlMs?: number;
  /** Max requests per window before blocking. */
  limit?: number;
  /** How long a client stays blocked after exceeding the limit, in milliseconds. */
  blockDurationMs?: number;
  /**
   * Progressive Rate Limiting (Phase 3C brief § Account Protection):
   * additional named throttler tiers layered on top of `default`, each
   * checked independently — a request is blocked the instant *any*
   * configured tier's limit is hit. The generous global default here is
   * deliberate: a named tier only becomes meaningfully strict where a
   * specific controller/route narrows it with `@Throttle({ <name>: {...} })`
   * (e.g. `strict` tightened to 5 requests/minute on `/auth/login`); left
   * at this tier's own default everywhere else, so adding a tier here
   * doesn't silently restrict every other route in the service.
   */
  additionalTiers?: { name: string; ttlMs?: number; limit?: number; blockDurationMs?: number }[];
}

/**
 * Providing/exporting `RedisThrottlerStorage` on its own — `ThrottlerModule.forRootAsync`'s
 * `inject` array resolves against modules visible through *its own*
 * `imports`, not a sibling module's `providers` (they're siblings, not
 * parent-child, in Nest's DI graph) — so this has to be a real module
 * `ThrottlerModule.forRootAsync` imports, not just another provider sitting
 * next to it in `RateLimitModule`.
 */
@Global()
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
class RedisThrottlerStorageModule {}

/**
 * Drop-in replacement for the plain `ThrottlerModule.forRoot([...])` every
 * Phase 1 app configured — same `@Throttle()`/`ThrottlerGuard` usage, but
 * backed by `RedisThrottlerStorage` instead of the default in-memory store,
 * so the limit holds across every running instance of a service, not just
 * per-process. Requires `CacheModule.forRoot()` imported in the app
 * (`@Global()`, same composition rule as the other `@ecoswift/*` infra
 * packages).
 */
@Module({})
export class RateLimitModule {
  static forRoot(options: RateLimitOptions = {}): DynamicModule {
    const throttlerOptions: ThrottlerOptions[] = [
      {
        name: 'default',
        ttl: options.ttlMs ?? 60_000,
        limit: options.limit ?? 100,
        blockDuration: options.blockDurationMs ?? 60_000,
      },
      ...(options.additionalTiers ?? []).map((tier) => ({
        name: tier.name,
        ttl: tier.ttlMs ?? 60_000,
        limit: tier.limit ?? 100,
        blockDuration: tier.blockDurationMs ?? 60_000,
      })),
    ];

    return {
      module: RateLimitModule,
      imports: [
        ThrottlerModule.forRootAsync({
          imports: [RedisThrottlerStorageModule],
          useFactory: (storage: RedisThrottlerStorage) => ({
            throttlers: throttlerOptions,
            storage,
          }),
          inject: [RedisThrottlerStorage],
        }),
      ],
      exports: [ThrottlerModule],
    };
  }
}
