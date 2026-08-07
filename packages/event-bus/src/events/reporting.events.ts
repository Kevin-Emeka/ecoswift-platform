import type { DomainEvent } from '../domain-event.base';

export const RECEIPT_GENERATED = 'reporting.receipt_generated' as const;
export interface ReceiptGeneratedPayload {
  transactionId: string;
  receiptUrl: string;
  format: string;
}
export type ReceiptGeneratedEvent = DomainEvent<typeof RECEIPT_GENERATED, ReceiptGeneratedPayload>;

export const STATEMENT_GENERATED = 'reporting.statement_generated' as const;
export interface StatementGeneratedPayload {
  accountId: string;
  statementId: string;
  periodStart: string;
  periodEnd: string;
  fileUrl?: string;
}
export type StatementGeneratedEvent = DomainEvent<typeof STATEMENT_GENERATED, StatementGeneratedPayload>;
