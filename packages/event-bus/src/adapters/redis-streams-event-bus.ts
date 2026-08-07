import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT } from '@ecoswift/cache';
import type { CreateDomainEventInput, DomainEvent } from '../domain-event.base';
import type { EventPublisherPort } from '../ports/event-publisher.port';
import type {
  EventHandler,
  EventSubscriberPort,
  SubscribeOptions,
} from '../ports/event-subscriber.port';

const STREAM_PREFIX = 'events:';
const DEAD_LETTER_PREFIX = 'events:dead-letter:';
const DEFAULT_MAX_ATTEMPTS = 5;
const BLOCK_MS = 5000;

interface Subscription {
  eventType: string;
  handler: EventHandler;
  consumerGroup: string;
  maxAttempts: number;
}

/**
 * Redis Streams implementation of both event bus ports — the concrete
 * choice `docs/domain-architecture.md` flagged as the default ("Redis
 * Streams — already in the stack") when it deliberately kept the domain
 * layer broker-agnostic. Swapping to RabbitMQ/Kafka later means writing a
 * new adapter against the same two ports, not touching any domain code.
 *
 * Delivery semantics: **at-least-once**, via consumer groups
 * (`XREADGROUP`/`XACK`). A handler that throws leaves its message pending;
 * it's retried on the next poll up to `maxAttempts`, after which it's moved
 * to a dead-letter stream (`events:dead-letter:<type>`) and acknowledged on
 * the original stream so it stops blocking that consumer group's progress.
 */
@Injectable()
export class RedisStreamsEventBus
  implements EventPublisherPort, EventSubscriberPort, OnModuleDestroy
{
  private readonly logger = new Logger(RedisStreamsEventBus.name);
  private readonly consumerName = `${process.pid}-${randomUUID().slice(0, 8)}`;
  private readonly subscriptions: Subscription[] = [];
  private readonly loops: Array<{ stop: () => void }> = [];
  private running = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster) {}

  async publish<TType extends string, TPayload>(
    input: CreateDomainEventInput<TType, TPayload>,
  ): Promise<DomainEvent<TType, TPayload>> {
    const event: DomainEvent<TType, TPayload> = {
      eventId: randomUUID(),
      eventType: input.eventType,
      occurredAt: new Date().toISOString(),
      correlationId: input.correlationId,
      producerContext: input.producerContext,
      payload: input.payload,
    };

    const streamKey = `${STREAM_PREFIX}${input.eventType}`;
    await this.redis.xadd(streamKey, '*', 'data', JSON.stringify(event));
    this.logger.debug(`Published ${input.eventType} (${event.eventId}) to ${streamKey}`);

    return event;
  }

  subscribe<TType extends string, TPayload>(
    eventType: TType,
    handler: EventHandler<TType, TPayload>,
    options: SubscribeOptions = {},
  ): void {
    this.subscriptions.push({
      eventType,
      handler: handler as EventHandler,
      consumerGroup: options.consumerGroup ?? `${eventType}:default`,
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    for (const subscription of this.subscriptions) {
      await this.ensureConsumerGroup(subscription);
      this.runConsumerLoop(subscription);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.loops.forEach((loop) => loop.stop());
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  private async ensureConsumerGroup(subscription: Subscription): Promise<void> {
    const streamKey = `${STREAM_PREFIX}${subscription.eventType}`;
    try {
      await this.redis.xgroup('CREATE', streamKey, subscription.consumerGroup, '0', 'MKSTREAM');
    } catch (error) {
      if (!(error as Error).message.includes('BUSYGROUP')) {
        throw error;
      }
      // BUSYGROUP means the group already exists — expected on every
      // restart after the first, not an error.
    }
  }

  private runConsumerLoop(subscription: Subscription): void {
    let stopped = false;
    this.loops.push({ stop: () => (stopped = true) });

    const streamKey = `${STREAM_PREFIX}${subscription.eventType}`;

    const loop = async () => {
      while (!stopped && this.running) {
        try {
          const results = await this.redis.xreadgroup(
            'GROUP',
            subscription.consumerGroup,
            this.consumerName,
            'COUNT',
            10,
            'BLOCK',
            BLOCK_MS,
            'STREAMS',
            streamKey,
            '>',
          );

          if (!results) continue;

          for (const [, messages] of results as unknown as Array<[string, Array<[string, string[]]>]>) {
            for (const [messageId, fields] of messages) {
              await this.processMessage(subscription, streamKey, messageId, fields);
            }
          }
        } catch (error) {
          this.logger.error(
            `Consumer loop error for ${subscription.eventType}/${subscription.consumerGroup}: ${(error as Error).message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };

    void loop();
  }

  private async processMessage(
    subscription: Subscription,
    streamKey: string,
    messageId: string,
    fields: string[],
  ): Promise<void> {
    const dataIndex = fields.indexOf('data');
    const raw = dataIndex >= 0 ? fields[dataIndex + 1] : undefined;
    if (!raw) {
      await this.redis.xack(streamKey, subscription.consumerGroup, messageId);
      return;
    }

    const event = JSON.parse(raw) as DomainEvent;

    try {
      await subscription.handler(event);
      await this.redis.xack(streamKey, subscription.consumerGroup, messageId);
    } catch (error) {
      const pending = (await this.redis.xpending(
        streamKey,
        subscription.consumerGroup,
        messageId,
        messageId,
        1,
      )) as unknown as Array<[string, string, number, number]>;
      const deliveryCount = Array.isArray(pending) && pending[0] ? Number(pending[0][3]) : 1;

      this.logger.warn(
        `Handler failed for ${subscription.eventType} (${event.eventId}), attempt ${deliveryCount}/${subscription.maxAttempts}: ${(error as Error).message}`,
      );

      if (deliveryCount >= subscription.maxAttempts) {
        await this.moveToDeadLetter(subscription, event, (error as Error).message);
        await this.redis.xack(streamKey, subscription.consumerGroup, messageId);
      }
      // Otherwise: leave unacknowledged — it's redelivered on a future
      // XREADGROUP poll by this or another consumer in the group.
    }
  }

  private async moveToDeadLetter(
    subscription: Subscription,
    event: DomainEvent,
    reason: string,
  ): Promise<void> {
    const dlqKey = `${DEAD_LETTER_PREFIX}${subscription.eventType}`;
    await this.redis.xadd(
      dlqKey,
      '*',
      'data',
      JSON.stringify(event),
      'reason',
      reason,
      'consumerGroup',
      subscription.consumerGroup,
    );
    this.logger.error(
      `Moved ${subscription.eventType} (${event.eventId}) to dead-letter stream after ${subscription.maxAttempts} attempts`,
    );
  }
}
