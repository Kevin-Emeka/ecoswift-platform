import type { DomainEvent } from '../domain-event.base';

export const AUDIT_RECORDED = 'audit.recorded' as const;
export interface AuditRecordedPayload {
  auditLogId: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  actorUserId?: string;
}
export type AuditRecordedEvent = DomainEvent<typeof AUDIT_RECORDED, AuditRecordedPayload>;
