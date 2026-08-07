import { type DynamicModule, Global, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { RedisStreamsEventBus } from './adapters/redis-streams-event-bus';
import { EVENT_PUBLISHER } from './ports/event-publisher.port';
import { EVENT_SUBSCRIBER } from './ports/event-subscriber.port';

/**
 * Binds `EVENT_PUBLISHER` and `EVENT_SUBSCRIBER` to a single shared
 * `RedisStreamsEventBus` instance (it implements both ports over one Redis
 * connection). Requires `@ecoswift/cache`'s `CacheModule.forRoot()` to be
 * imported in the app (for `REDIS_CLIENT`) — same composition rule as
 * `@ecoswift/resilience`.
 *
 * Consumer loops (`EventSubscriberPort.start()`) begin automatically on
 * `onApplicationBootstrap`, after every module has had a chance to register
 * its `subscribe()` calls in their own `onModuleInit`.
 */
@Global()
@Module({})
export class EventBusModule implements OnApplicationBootstrap {
  constructor(private readonly bus: RedisStreamsEventBus) {}

  static forRoot(): DynamicModule {
    return {
      module: EventBusModule,
      providers: [
        RedisStreamsEventBus,
        { provide: EVENT_PUBLISHER, useExisting: RedisStreamsEventBus },
        { provide: EVENT_SUBSCRIBER, useExisting: RedisStreamsEventBus },
      ],
      exports: [EVENT_PUBLISHER, EVENT_SUBSCRIBER, RedisStreamsEventBus],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.start();
  }
}
