import type { DomainEvent } from '../domain-event.base';

export const LOAN_APPROVED = 'loan.approved' as const;
export interface LoanApprovedPayload {
  loanApplicationId: string;
  loanId: string;
  customerId: string;
  approvedAmount: string;
  currencyCode: string;
  termMonths: number;
}
export type LoanApprovedEvent = DomainEvent<typeof LOAN_APPROVED, LoanApprovedPayload>;

export const LOAN_REJECTED = 'loan.rejected' as const;
export interface LoanRejectedPayload {
  loanApplicationId: string;
  customerId: string;
  reasonCode: string;
}
export type LoanRejectedEvent = DomainEvent<typeof LOAN_REJECTED, LoanRejectedPayload>;
