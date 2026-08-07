import { type DynamicModule, Global, Module } from '@nestjs/common';
import { createRedisClient } from './redis-client.factory';
import { REDIS_CLIENT } from './redis.tokens';
import { CacheService } from './cache.service';
import { DistributedLockService } from './distributed-lock.service';

/**
 * Global module providing a single shared Redis connection (`REDIS_CLIENT`),
 * `CacheService` (cache-aside helper), and `DistributedLockService` to every
 * other module in the app without each one re-deriving connection config.
 *
 * Reads directly from `process.env` (already validated at bootstrap by each
 * app's `validate()` pipe against `@ecoswift/config`'s `envSchema`) rather
 * than through Nest's `ConfigService` and a namespaced key — that would
 * require every one of the 14 apps/services to independently remember to
 * register a `redis.*` config namespace with matching key names, which is
 * exactly the kind of drift-prone convention this package exists to avoid.
 */
@Global()
@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: () =>
            createRedisClient({
              url: process.env.REDIS_URL!,
              clusterEnabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
              clusterNodes: process.env.REDIS_CLUSTER_NODES,
              tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
            }),
        },
        CacheService,
        DistributedLockService,
      ],
      exports: [REDIS_CLIENT, CacheService, DistributedLockService],
    };
  }
}
