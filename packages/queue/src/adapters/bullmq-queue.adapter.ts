import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { EnqueueOptions, QueuePort } from '../ports/queue.port';

/**
 * BullMQ-backed implementation of `QueuePort`. BullMQ was chosen over a
 * hand-rolled Redis list/stream queue because job retry-with-backoff,
 * delayed jobs, priority, and repeatable (cron) jobs are exactly the
 * primitives this phase's brief asks for (Background Worker framework, Job
 * Scheduler) and BullMQ implements all of them correctly on top of Redis
 * already — reimplementing that is real distributed-systems work with no
 * payoff over using the well-tested library.
 */
export class BullMQQueueAdapter<TPayload> implements QueuePort<TPayload> {
  // All 6 of BullMQ's Queue generics pinned explicitly — its 6th
  // (`NameType`) defaults to `ExtractNameType<TPayload, DefaultNameType>`,
  // a conditional type that doesn't resolve cleanly against an unresolved
  // generic `TPayload`, so it's set to `string` directly rather than left
  // to inference (the job name this adapter always passes is a string).
  readonly queue: Queue<TPayload, unknown, string, TPayload, unknown, string>;

  constructor(
    public readonly name: string,
    connection: ConnectionOptions,
    private readonly defaultAttempts = 5,
  ) {
    this.queue = new Queue<TPayload, unknown, string, TPayload, unknown, string>(name, {
      connection,
      defaultJobOptions: {
        attempts: defaultAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
  }

  async enqueue(data: TPayload, options: EnqueueOptions = {}): Promise<string> {
    const job = await this.queue.add(this.name, data, {
      delay: options.delayMs,
      attempts: options.attempts ?? this.defaultAttempts,
      priority: options.priority,
      jobId: options.jobId,
    });
    return job.id ?? '';
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
