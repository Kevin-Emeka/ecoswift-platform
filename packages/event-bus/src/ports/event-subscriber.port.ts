import type { DomainEvent } from '../domain-event.base';

export type EventHandler<TType extends string = string, TPayload = unknown> = (
  event: DomainEvent<TType, TPayload>,
) => Promise<void>;

export interface SubscribeOptions {
  /**
   * Consumer group name — every subscriber in the same group shares the
   * event stream's workload (each event delivered to one member); two
   * different groups each get their own independent full copy of the
   * stream. Defaults to `<eventType>:<producerContext-of-subscriber>` at
   * the adapter level if omitted, but should normally be set explicitly to
   * the subscribing service's own name.
   */
  consumerGroup?: string;
  /** Max delivery attempts before an event is moved to the dead-letter stream. */
  maxAttempts?: number;
}

/**
 * Port every domain context subscribes through — matches
 * `docs/domain-architecture.md` § Service Communication (at-least-once
 * delivery, consumer-side retry, DLQ on exhaustion).
 */
export interface EventSubscriberPort {
  subscribe<TType extends string, TPayload>(
    eventType: TType,
    handler: EventHandler<TType, TPayload>,
    options?: SubscribeOptions,
  ): void;

  /** Starts consuming for every `subscribe()` call registered so far. Idempotent. */
  start(): Promise<void>;

  /** Stops all consumer loops gracefully (finishes in-flight handlers first). */
  stop(): Promise<void>;
}

export const EVENT_SUBSCRIBER = Symbol('EVENT_SUBSCRIBER');
