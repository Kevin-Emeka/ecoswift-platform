export interface EnqueueOptions {
  /** Delay before the job becomes eligible to run, in milliseconds. */
  delayMs?: number;
  /** Max retry attempts on failure. */
  attempts?: number;
  /** Job priority — lower runs first. Omit for FIFO. */
  priority?: number;
  /** Dedupe key — enqueuing the same key while a matching job is active/waiting is a no-op. */
  jobId?: string;
}

/**
 * The message-queue abstraction every named queue in `@ecoswift/queue`
 * implements this against — application code (e.g. `notification-service`
 * enqueuing an email) depends on this port, not on BullMQ directly, so the
 * underlying queue technology is swappable the same way the event bus
 * transport is (`domain-architecture.md` § Service Communication).
 */
export interface QueuePort<TPayload> {
  readonly name: string;
  enqueue(data: TPayload, options?: EnqueueOptions): Promise<string>;
}
