/**
 * The 7 named queues from the Phase 2C brief. Each is a distinct BullMQ
 * queue (its own Redis keys, its own worker concurrency, its own DLQ
 * behavior via BullMQ's built-in failed-job retention) rather than one
 * shared "jobs" queue with a type discriminator — so a burst of statement
 * generation can never starve email delivery, and each can scale its
 * worker count independently.
 *
 * No `:` in these names — BullMQ uses colons as its own internal Redis key
 * delimiter and rejects queue names containing one.
 */
export const QUEUE_NAMES = {
  EMAIL: 'ecoswift-email',
  SMS: 'ecoswift-sms',
  PUSH: 'ecoswift-push',
  RECEIPTS: 'ecoswift-receipts',
  STATEMENTS: 'ecoswift-statements',
  AUDIT_LOGS: 'ecoswift-audit-logs',
  REPORTS: 'ecoswift-reports',
  // Milestone 2: executes/reschedules ScheduledTransfer rows — see
  // account-service's ScheduledTransferWorker.
  TRANSFERS: 'ecoswift-transfers',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
