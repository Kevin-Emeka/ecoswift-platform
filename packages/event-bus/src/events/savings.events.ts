import type { DomainEvent } from '../domain-event.base';

export const SAVINGS_CREATED = 'savings.created' as const;
export interface SavingsCreatedPayload {
  savingsAccountId: string;
  customerId: string;
  savingsProductCode: string;
  goalAmount?: string;
  currencyCode: string;
}
export type SavingsCreatedEvent = DomainEvent<typeof SAVINGS_CREATED, SavingsCreatedPayload>;

export const INTEREST_POSTED = 'savings.interest_posted' as const;
export interface InterestPostedPayload {
  savingsAccountId: string;
  journalEntryId?: string;
  amount: string;
  currencyCode: string;
  period: string;
}
export type InterestPostedEvent = DomainEvent<typeof INTEREST_POSTED, InterestPostedPayload>;
