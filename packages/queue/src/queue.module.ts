import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { REDIS_CLIENT } from '@ecoswift/cache';
import { BullMQQueueAdapter } from './adapters/bullmq-queue.adapter';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import {
  AUDIT_LOGS_QUEUE,
  BULLMQ_CONNECTION,
  EMAIL_QUEUE,
  PUSH_QUEUE,
  RECEIPTS_QUEUE,
  REPORTS_QUEUE,
  SMS_QUEUE,
  STATEMENTS_QUEUE,
  TRANSFERS_QUEUE,
} from './queue.tokens';
import { QUEUE_NAMES } from './queues/queue-names';
import type {
  AuditLogJobPayload,
  EmailJobPayload,
  PushJobPayload,
  ReceiptJobPayload,
  ReportJobPayload,
  ScheduledTransferJobPayload,
  SmsJobPayload,
  StatementJobPayload,
} from './queues/payloads';

/**
 * Provides the 7 named queues (as `QueuePort` implementations, injectable
 * by token) plus `JobSchedulerService`. Reuses `@ecoswift/cache`'s shared
 * `REDIS_CLIENT` as BullMQ's connection — BullMQ duplicates connections
 * internally as needed (its own recommended pattern for reusing a client),
 * so this doesn't create N redundant Redis connections for N queues.
 *
 * Requires `CacheModule.forRoot()` to be imported in the app (`@Global()`,
 * same composition rule as `@ecoswift/resilience` and `@ecoswift/event-bus`).
 */
@Global()
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      providers: [
        { provide: BULLMQ_CONNECTION, inject: [REDIS_CLIENT], useFactory: (redis) => redis as ConnectionOptions },
        {
          provide: EMAIL_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<EmailJobPayload>(QUEUE_NAMES.EMAIL, connection),
        },
        {
          provide: SMS_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<SmsJobPayload>(QUEUE_NAMES.SMS, connection),
        },
        {
          provide: PUSH_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<PushJobPayload>(QUEUE_NAMES.PUSH, connection),
        },
        {
          provide: RECEIPTS_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<ReceiptJobPayload>(QUEUE_NAMES.RECEIPTS, connection),
        },
        {
          provide: STATEMENTS_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<StatementJobPayload>(QUEUE_NAMES.STATEMENTS, connection),
        },
        {
          provide: AUDIT_LOGS_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<AuditLogJobPayload>(QUEUE_NAMES.AUDIT_LOGS, connection),
        },
        {
          provide: REPORTS_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<ReportJobPayload>(QUEUE_NAMES.REPORTS, connection),
        },
        {
          provide: TRANSFERS_QUEUE,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) =>
            new BullMQQueueAdapter<ScheduledTransferJobPayload>(QUEUE_NAMES.TRANSFERS, connection),
        },
        {
          provide: JobSchedulerService,
          inject: [BULLMQ_CONNECTION],
          useFactory: (connection: ConnectionOptions) => new JobSchedulerService(connection),
        },
      ],
      exports: [
        EMAIL_QUEUE,
        SMS_QUEUE,
        PUSH_QUEUE,
        RECEIPTS_QUEUE,
        STATEMENTS_QUEUE,
        AUDIT_LOGS_QUEUE,
        REPORTS_QUEUE,
        TRANSFERS_QUEUE,
        JobSchedulerService,
        BULLMQ_CONNECTION,
      ],
    };
  }
}
