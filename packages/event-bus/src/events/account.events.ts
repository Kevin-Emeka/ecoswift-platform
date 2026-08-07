import type { DomainEvent } from '../domain-event.base';

export const ACCOUNT_OPENED = 'account.opened' as const;
export interface AccountOpenedPayload {
  accountId: string;
  accountNumber: string;
  customerId: string;
  accountTypeCode: string;
  currencyCode: string;
}
export type AccountOpenedEvent = DomainEvent<typeof ACCOUNT_OPENED, AccountOpenedPayload>;

/** Phase 4A — any `AccountStatus` transition (activate, freeze, unfreeze, close, restrict, unrestrict, dormant, reactivate). */
export const ACCOUNT_STATUS_CHANGED = 'account.status_changed' as const;
export interface AccountStatusChangedPayload {
  accountId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
}
export type AccountStatusChangedEvent = DomainEvent<typeof ACCOUNT_STATUS_CHANGED, AccountStatusChangedPayload>;
