import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker, type ConnectionOptions, type Job } from 'bullmq';

export interface WorkerOptions {
  concurrency?: number;
}

/**
 * Background Worker framework: subclass this, implement `process()`, and
 * the base class handles BullMQ wiring, structured completion/failure
 * logging, and graceful shutdown (`OnModuleDestroy` waits for in-flight
 * jobs rather than killing them mid-processing). This is the shape every
 * queue consumer in the platform (email sending, SMS sending, receipt
 * generation, etc.) should follow rather than each service wiring BullMQ
 * `Worker` directly and re-deriving this boilerplate.
 *
 * Retry/backoff is configured on the *producer* side (`BullMQQueueAdapter`'s
 * `defaultJobOptions`) — the worker doesn't need to know its own retry
 * policy, it just reports success/failure per attempt.
 */
export abstract class BaseWorker<TPayload> implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  private worker?: Worker<TPayload>;

  protected abstract readonly queueName: string;
  protected abstract process(job: Job<TPayload>): Promise<void>;

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly options: WorkerOptions = {},
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<TPayload>(
      this.queueName,
      async (job) => this.process(job),
      {
        connection: this.buildWorkerConnection(),
        concurrency: this.options.concurrency ?? 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed (queue: ${this.queueName})`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        `Job ${job?.id} failed (queue: ${this.queueName}, attempt ${job?.attemptsMade}): ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /**
   * `BULLMQ_CONNECTION` is `@ecoswift/cache`'s shared, already-connected
   * ioredis client (reused as-is by producers — see `QueueModule`'s
   * doc comment). BullMQ's `Worker` refuses that: it issues blocking
   * commands and requires `maxRetriesPerRequest: null` on its connection,
   * which the shared client isn't configured with (it needs bounded
   * retries for ordinary cache/producer use). Deriving a fresh
   * options object from the shared client's own `.options` — rather
   * than reusing the live instance — gives the Worker its own
   * correctly-configured connection without touching the shared one.
   */
  private buildWorkerConnection(): ConnectionOptions {
    const shared = this.connection as unknown as { options?: Record<string, unknown> };
    if (shared?.options) {
      return { ...shared.options, maxRetriesPerRequest: null } as ConnectionOptions;
    }
    return { ...(this.connection as object), maxRetriesPerRequest: null } as ConnectionOptions;
  }
}
