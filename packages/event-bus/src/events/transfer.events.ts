import type { DomainEvent } from '../domain-event.base';

export const TRANSFER_STARTED = 'transfer.started' as const;
export interface TransferStartedPayload {
  transactionId: string;
  transactionReference: string;
  sourceAccountId: string;
  destinationAccountId?: string;
  amount: string;
  currencyCode: string;
  idempotencyKey?: string;
}
export type TransferStartedEvent = DomainEvent<typeof TRANSFER_STARTED, TransferStartedPayload>;

export const TRANSFER_COMPLETED = 'transfer.completed' as const;
export interface TransferCompletedPayload {
  transactionId: string;
  transactionReference: string;
  journalEntryId: string;
  completedAt: string;
}
export type TransferCompletedEvent = DomainEvent<typeof TRANSFER_COMPLETED, TransferCompletedPayload>;

export const TRANSFER_FAILED = 'transfer.failed' as const;
export interface TransferFailedPayload {
  transactionId: string;
  transactionReference: string;
  reasonCode: string;
  failedAt: string;
}
export type TransferFailedEvent = DomainEvent<typeof TRANSFER_FAILED, TransferFailedPayload>;

export const DEPOSIT_POSTED = 'ledger.deposit_posted' as const;
export interface DepositPostedPayload {
  accountId: string;
  transactionId: string;
  journalEntryId: string;
  amount: string;
  currencyCode: string;
  source: string;
}
export type DepositPostedEvent = DomainEvent<typeof DEPOSIT_POSTED, DepositPostedPayload>;

export const WITHDRAWAL_POSTED = 'ledger.withdrawal_posted' as const;
export interface WithdrawalPostedPayload {
  accountId: string;
  transactionId: string;
  journalEntryId: string;
  amount: string;
  currencyCode: string;
  destination: string;
}
export type WithdrawalPostedEvent = DomainEvent<typeof WITHDRAWAL_POSTED, WithdrawalPostedPayload>;
