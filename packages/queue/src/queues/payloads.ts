/** Job payloads for each named queue — the contract between producer and worker. */

export interface EmailJobPayload {
  notificationId: string;
  toAddress: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
}

export interface SmsJobPayload {
  notificationId: string;
  toNumber: string;
  message: string;
}

export interface PushJobPayload {
  notificationId: string;
  deviceId?: string;
  title: string;
  body: string;
}

export interface ReceiptJobPayload {
  transactionId: string;
  format: 'PDF' | 'CSV' | 'JSON';
}

export interface StatementJobPayload {
  statementRequestId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  format: 'PDF' | 'CSV' | 'XLSX' | 'JSON';
}

export interface AuditLogJobPayload {
  actorUserId?: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  correlationId?: string;
}

export interface ReportJobPayload {
  reportJobId: string;
  reportType: 'STATEMENT' | 'REGULATORY' | 'TAX' | 'INTERNAL_AUDIT' | 'CUSTOM';
  parameters?: Record<string, unknown>;
}

/** Just an id — the worker always loads current state from `ScheduledTransfer` rather than trusting a payload that could be stale by the time a delayed job fires. */
export interface ScheduledTransferJobPayload {
  scheduledTransferId: string;
}
