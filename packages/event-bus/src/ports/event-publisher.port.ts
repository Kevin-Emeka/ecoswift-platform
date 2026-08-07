import type { CreateDomainEventInput, DomainEvent } from '../domain-event.base';

/**
 * Port every domain context publishes through — matches
 * `docs/domain-architecture.md` § Service Communication: "the domain layer
 * is written against the port, not the broker SDK, so that decision doesn't
 * ripple through business logic later."
 */
export interface EventPublisherPort {
  publish<TType extends string, TPayload>(
    input: CreateDomainEventInput<TType, TPayload>,
  ): Promise<DomainEvent<TType, TPayload>>;
}

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
