import { Injectable, Logger } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';

export interface RecurringJobDefinition<TPayload> {
  queueName: string;
  jobName: string;
  /** Standard 5-field cron expression, evaluated in UTC (see database-architecture.md's UTC-timestamps standard — scheduling follows the same rule). */
  cronPattern: string;
  payload: TPayload;
}

/**
 * Job Scheduler: registers recurring jobs (month-end interest posting,
 * daily dormancy sweeps, nightly report generation, etc.) as BullMQ
 * repeatable jobs — the same underlying queues the on-demand producers use,
 * so a scheduled job and an on-demand job for the same queue are processed
 * by the exact same `BaseWorker`, not a separate scheduling system.
 */
@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly connection: ConnectionOptions) {}

  async scheduleRecurring<TPayload>(definition: RecurringJobDefinition<TPayload>): Promise<void> {
    const queue = this.getQueue(definition.queueName);

    await queue.upsertJobScheduler(
      definition.jobName,
      { pattern: definition.cronPattern, tz: 'UTC' },
      { name: definition.jobName, data: definition.payload as Record<string, unknown> },
    );

    this.logger.log(
      `Scheduled recurring job "${definition.jobName}" on queue "${definition.queueName}" (${definition.cronPattern} UTC)`,
    );
  }

  async cancelRecurring(queueName: string, jobName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.removeJobScheduler(jobName);
  }

  private getQueue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;

    const queue = new Queue(name, { connection: this.connection });
    this.queues.set(name, queue);
    return queue;
  }
}
