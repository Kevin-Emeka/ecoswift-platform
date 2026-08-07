/**
 * Every domain event published on the bus carries this envelope, matching
 * `docs/domain-architecture.md` § Shared Kernel — `eventId`/`occurredAt`/
 * `correlationId`/`producerContext` are implicit on every event in the
 * Phase 2A catalog (`docs/events.md`) and are made explicit here so the
 * transport layer (`RedisStreamsEventBus`) has a single shape to serialize.
 */
export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  eventId: string;
  eventType: TType;
  occurredAt: string;
  correlationId?: string;
  producerContext: string;
  payload: TPayload;
}

export interface CreateDomainEventInput<TType extends string, TPayload> {
  eventType: TType;
  producerContext: string;
  payload: TPayload;
  correlationId?: string;
}
