import type { DomainEvent } from '../domain-event.base';

/**
 * Phase 3A — Identity & Authentication events. `EMAIL_VERIFIED` already
 * exists in `customer.events.ts`; `USER_REGISTERED` here is Identity &
 * Access's own fact (a `User`/credential record was created), distinct
 * from `CUSTOMER_REGISTERED` (Customer Management's fact that a `Customer`
 * record was created) — both fire from the same registration action, per
 * `workflows.md` § Customer Registration, because they're two different
 * bounded contexts each recording their own aggregate coming into being.
 */
export const USER_REGISTERED = 'identity.user_registered' as const;
export interface UserRegisteredPayload {
  userId: string;
  email: string;
  actorType: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
}
export type UserRegisteredEvent = DomainEvent<typeof USER_REGISTERED, UserRegisteredPayload>;

export const EMAIL_VERIFICATION_REQUESTED = 'identity.email_verification_requested' as const;
export interface EmailVerificationRequestedPayload {
  userId: string;
  email: string;
}
export type EmailVerificationRequestedEvent = DomainEvent<
  typeof EMAIL_VERIFICATION_REQUESTED,
  EmailVerificationRequestedPayload
>;

export const PHONE_VERIFICATION_REQUESTED = 'identity.phone_verification_requested' as const;
export interface PhoneVerificationRequestedPayload {
  userId: string;
  phone: string;
}
export type PhoneVerificationRequestedEvent = DomainEvent<
  typeof PHONE_VERIFICATION_REQUESTED,
  PhoneVerificationRequestedPayload
>;

export const PHONE_VERIFIED = 'identity.phone_verified' as const;
export interface PhoneVerifiedPayload {
  userId: string;
  phone: string;
  verifiedAt: string;
}
export type PhoneVerifiedEvent = DomainEvent<typeof PHONE_VERIFIED, PhoneVerifiedPayload>;

export const LOGIN_SUCCEEDED = 'identity.login_succeeded' as const;
export interface LoginSucceededPayload {
  userId: string;
  sessionId: string;
  deviceId?: string;
  ipAddress: string;
  isNewDevice: boolean;
}
export type LoginSucceededEvent = DomainEvent<typeof LOGIN_SUCCEEDED, LoginSucceededPayload>;

export const LOGIN_FAILED = 'identity.login_failed' as const;
export interface LoginFailedPayload {
  identifier: string;
  reason: string;
  ipAddress: string;
}
export type LoginFailedEvent = DomainEvent<typeof LOGIN_FAILED, LoginFailedPayload>;

export const LOGOUT_SUCCEEDED = 'identity.logout_succeeded' as const;
export interface LogoutSucceededPayload {
  userId: string;
  sessionId: string;
}
export type LogoutSucceededEvent = DomainEvent<typeof LOGOUT_SUCCEEDED, LogoutSucceededPayload>;

export const PASSWORD_CHANGED = 'identity.password_changed' as const;
export interface PasswordChangedPayload {
  userId: string;
  changedVia: 'SELF_SERVICE' | 'PASSWORD_RESET';
}
export type PasswordChangedEvent = DomainEvent<typeof PASSWORD_CHANGED, PasswordChangedPayload>;

export const PASSWORD_RESET_REQUESTED = 'identity.password_reset_requested' as const;
export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
}
export type PasswordResetRequestedEvent = DomainEvent<
  typeof PASSWORD_RESET_REQUESTED,
  PasswordResetRequestedPayload
>;

export const PASSWORD_RESET_COMPLETED = 'identity.password_reset_completed' as const;
export interface PasswordResetCompletedPayload {
  userId: string;
}
export type PasswordResetCompletedEvent = DomainEvent<
  typeof PASSWORD_RESET_COMPLETED,
  PasswordResetCompletedPayload
>;

export const SESSION_CREATED = 'identity.session_created' as const;
export interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  deviceId?: string;
  ipAddress: string;
}
export type SessionCreatedEvent = DomainEvent<typeof SESSION_CREATED, SessionCreatedPayload>;

export const SESSION_REVOKED = 'identity.session_revoked' as const;
export interface SessionRevokedPayload {
  sessionId: string;
  userId: string;
  reason: string;
}
export type SessionRevokedEvent = DomainEvent<typeof SESSION_REVOKED, SessionRevokedPayload>;
