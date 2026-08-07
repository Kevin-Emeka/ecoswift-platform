import type { DomainEvent } from '../domain-event.base';

/**
 * Phase 3C — Enterprise Security & Fraud Prevention events: MFA, device
 * security, session security, and fraud-hook signal observability. Every
 * one of these is published *in addition to*, never instead of, the
 * `SecurityEvent` row `SecurityEventService` writes for the same action —
 * see docs/security.md § Observability for why both exist (the same
 * durable-record-plus-real-time-notification split docs/compliance-controls.md
 * establishes for `AuditLog` in Phase 3B).
 */

export const MFA_ENROLLED = 'security.mfa_enrolled' as const;
export interface MfaEnrolledPayload {
  userId: string;
  method: 'TOTP' | 'SMS' | 'EMAIL';
}
export type MfaEnrolledEvent = DomainEvent<typeof MFA_ENROLLED, MfaEnrolledPayload>;

export const MFA_DISABLED = 'security.mfa_disabled' as const;
export interface MfaDisabledPayload {
  userId: string;
  method: 'TOTP' | 'SMS' | 'EMAIL';
}
export type MfaDisabledEvent = DomainEvent<typeof MFA_DISABLED, MfaDisabledPayload>;

export const MFA_CHALLENGE_SUCCEEDED = 'security.mfa_challenge_succeeded' as const;
export interface MfaChallengeSucceededPayload {
  userId: string;
  method: 'TOTP' | 'SMS' | 'EMAIL' | 'BACKUP_CODE';
}
export type MfaChallengeSucceededEvent = DomainEvent<typeof MFA_CHALLENGE_SUCCEEDED, MfaChallengeSucceededPayload>;

export const MFA_CHALLENGE_FAILED = 'security.mfa_challenge_failed' as const;
export interface MfaChallengeFailedPayload {
  userId: string;
  method: 'TOTP' | 'SMS' | 'EMAIL' | 'BACKUP_CODE';
}
export type MfaChallengeFailedEvent = DomainEvent<typeof MFA_CHALLENGE_FAILED, MfaChallengeFailedPayload>;

export const STEP_UP_COMPLETED = 'security.step_up_completed' as const;
export interface StepUpCompletedPayload {
  userId: string;
  sessionId: string;
}
export type StepUpCompletedEvent = DomainEvent<typeof STEP_UP_COMPLETED, StepUpCompletedPayload>;

export const DEVICE_REGISTERED = 'security.device_registered' as const;
export interface DeviceRegisteredPayload {
  userId: string;
  deviceId: string;
  ipAddress: string;
}
export type DeviceRegisteredEvent = DomainEvent<typeof DEVICE_REGISTERED, DeviceRegisteredPayload>;

export const DEVICE_REVOKED = 'security.device_revoked' as const;
export interface DeviceRevokedPayload {
  userId: string;
  deviceId: string;
  reason: string;
}
export type DeviceRevokedEvent = DomainEvent<typeof DEVICE_REVOKED, DeviceRevokedPayload>;

export const SUSPICIOUS_SESSION_DETECTED = 'security.suspicious_session_detected' as const;
export interface SuspiciousSessionDetectedPayload {
  userId: string;
  sessionId: string;
  reason: string;
  previousIpAddress: string;
  newIpAddress: string;
}
export type SuspiciousSessionDetectedEvent = DomainEvent<
  typeof SUSPICIOUS_SESSION_DETECTED,
  SuspiciousSessionDetectedPayload
>;

export const FRAUD_SIGNAL_DETECTED = 'security.fraud_signal_detected' as const;
export interface FraudSignalDetectedPayload {
  userId: string;
  signalType: string;
  score: number;
  reason?: string;
}
export type FraudSignalDetectedEvent = DomainEvent<typeof FRAUD_SIGNAL_DETECTED, FraudSignalDetectedPayload>;
