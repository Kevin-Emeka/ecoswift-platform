import type { DomainEvent } from '../domain-event.base';

export const CUSTOMER_REGISTERED = 'customer.registered' as const;
export interface CustomerRegisteredPayload {
  customerId: string;
  userId: string;
  fullName: string;
  primaryContact: string;
}
export type CustomerRegisteredEvent = DomainEvent<typeof CUSTOMER_REGISTERED, CustomerRegisteredPayload>;

export const EMAIL_VERIFIED = 'identity.email_verified' as const;
export interface EmailVerifiedPayload {
  userId: string;
  email: string;
  verifiedAt: string;
}
export type EmailVerifiedEvent = DomainEvent<typeof EMAIL_VERIFIED, EmailVerifiedPayload>;
