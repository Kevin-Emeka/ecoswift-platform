# Ecoswift Bank — Queues & Background Workers

**Phase 2C deliverable.** The message queue abstraction, background worker framework, job scheduler, and the 7 named queues from the brief. Implemented in [`packages/queue`](../packages/queue) on top of [BullMQ](https://docs.bullmq.io/) — see [`infrastructure.md`](infrastructure.md) for how this fits the rest of the platform.

## Why BullMQ, Not a Hand-Rolled Queue

Job retry-with-exponential-backoff, delayed jobs, priority ordering, and repeatable (cron) jobs are exactly the primitives this phase's brief asks for (Background Worker framework, Job Scheduler). BullMQ implements all of them correctly on top of Redis already, with years of production hardening — reimplementing that correctly is real distributed-systems work (exactly-once delivery semantics, at-least-once retry bookkeeping, clock-skew-safe delayed jobs) with no payoff over using the well-tested library. The abstraction (`QueuePort`) exists so that choice stays swappable, not because BullMQ itself is expected to change.

## The Abstraction

```ts
interface QueuePort<TPayload> {
  readonly name: string;
  enqueue(data: TPayload, options?: EnqueueOptions): Promise<string>; // returns job id
}
```

`BullMQQueueAdapter<TPayload>` (`packages/queue/src/adapters/bullmq-queue.adapter.ts`) implements it. Application code depends on `QueuePort`, injected by the queue's DI token (`EMAIL_QUEUE`, `SMS_QUEUE`, etc.) — never on `bullmq`'s `Queue` class directly, so a future migration to a different backend touches one adapter, not every producer.

Default job options (set once, per queue, in the adapter): 5 retry attempts, exponential backoff starting at 2s, completed jobs retained for 24h/1000 most recent (whichever is smaller), failed jobs retained for 7 days (long enough to investigate, bounded so Redis doesn't grow unbounded from a persistent failure).

## The 7 Named Queues

| Queue | Token | Payload | Purpose |
|---|---|---|---|
| Emails | `EMAIL_QUEUE` | `EmailJobPayload` | Outbound transactional email delivery |
| SMS | `SMS_QUEUE` | `SmsJobPayload` | Outbound SMS delivery (OTP, alerts) |
| Push Notifications | `PUSH_QUEUE` | `PushJobPayload` | Mobile push delivery |
| Receipts | `RECEIPTS_QUEUE` | `ReceiptJobPayload` | Transaction receipt generation |
| Statements | `STATEMENTS_QUEUE` | `StatementJobPayload` | Account statement generation |
| Audit Logs | `AUDIT_LOGS_QUEUE` | `AuditLogJobPayload` | Asynchronous audit record ingestion |
| Reports | `REPORTS_QUEUE` | `ReportJobPayload` | Regulatory/internal report generation |

Each is a **distinct** BullMQ queue — its own Redis keys, its own worker concurrency, its own retry/DLQ bookkeeping — rather than one shared "jobs" queue with a type discriminator. This is deliberate: a burst of statement generation at month-end must never starve email delivery, and each queue's worker pool scales independently based on its own load, which isn't possible if they share one underlying queue.

Redis key naming: `ecoswift-email`, `ecoswift-sms`, etc. (`packages/queue/src/queues/queue-names.ts`) — **no colons**. BullMQ uses `:` as its own internal Redis key delimiter and rejects queue names containing one; this was caught live (`Error: Queue name cannot contain :`) during integration testing against a real Redis instance, not at typecheck time, since it's a runtime validation inside BullMQ's constructor.

Payload shapes (`packages/queue/src/queues/payloads.ts`) are the producer/worker contract — e.g. `EmailJobPayload` carries `notificationId`, `toAddress`, `subject`, `bodyHtml`/`bodyText`, matching the `EmailQueue` table's columns from the Phase 2B schema (`prisma/schema.prisma`), so a worker writing back status (`EmailQueue.status`, `attempts`, `sentAt`) has everything it needs from the job payload alone.

## Background Worker Framework

```ts
export class EmailWorker extends BaseWorker<EmailJobPayload> {
  protected readonly queueName = QUEUE_NAMES.EMAIL;

  protected async process(job: Job<EmailJobPayload>): Promise<void> {
    // deliver job.data via an EmailGatewayPort adapter (Phase 3 — not
    // implemented here, this phase ships the framework, not the SMTP call)
  }
}
```

`BaseWorker<TPayload>` (`packages/queue/src/worker/worker.base.ts`) is the abstract base every queue consumer extends: subclass it, implement `process()`, and the base class handles BullMQ `Worker` wiring, structured completion/failure logging, and graceful shutdown (`OnModuleDestroy` waits for in-flight jobs to finish rather than killing them mid-processing — a job half-sent is worse than a job sent late). Retry/backoff policy lives on the **producer** side (the adapter's `defaultJobOptions`) — a worker never needs to know its own retry policy, it just reports success or failure per attempt and BullMQ handles the rest.

This phase ships the framework and the queue/payload definitions, not the concrete workers — actually calling out to an SMTP server, Twilio, or a push provider is business/integration logic that belongs to the services that own those concerns (`email-service`, `sms-service`, `notification-service`, all already scaffolded in Phase 1) in Phase 3+, per this phase's "no business logic" boundary.

## Job Scheduler

```ts
await jobScheduler.scheduleRecurring({
  queueName: QUEUE_NAMES.STATEMENTS,
  jobName: 'monthly-statement-generation',
  cronPattern: '0 2 1 * *', // 02:00 UTC, first of every month
  payload: { /* ... */ },
});
```

`JobSchedulerService` (`packages/queue/src/scheduler/job-scheduler.service.ts`) wraps BullMQ's `upsertJobScheduler` — recurring jobs (month-end interest posting, nightly dormancy sweeps, scheduled report generation) are registered against the **same queues** the on-demand producers use, processed by the **same** `BaseWorker`, not a parallel scheduling system with its own worker pool to keep in sync. Cron patterns are evaluated in UTC — matching `database-architecture.md`'s UTC-timestamps standard, so "runs at 2am" means the same instant regardless of which region's instance evaluates it.

## Failure Handling

- **Retries**: exponential backoff (2s, 4s, 8s, ...), 5 attempts by default, configurable per-enqueue via `EnqueueOptions.attempts`.
- **Dead letters**: BullMQ retains failed jobs (up to the 7-day/count bound above) rather than a separate DLQ stream — inspectable via BullMQ's own tooling (Bull Board, or direct Redis inspection) once wired up operationally.
- **Idempotency**: workers that call an external, non-idempotent API (an SMS provider, a payment rail) should wrap that call with `@ecoswift/resilience`'s `IdempotencyService`, keyed on the job's own id — a retried job must not re-send an SMS that already went out. This is a pattern to follow when the concrete workers are built (Phase 3+), not something `BaseWorker` enforces automatically, since not every job is calling a non-idempotent external system.

## Verified Live

`QueueModule.forRoot()` was booted against a real Redis instance as part of `apps/api`'s reference integration (`infrastructure.md` § Reference Integration). `redis-cli KEYS "*"` on the running container showed `bull:ecoswift-email:meta`, `bull:ecoswift-sms:meta`, and the other 5 queues' meta keys — confirming BullMQ actually initialized all 7 queues correctly against the shared Redis connection, not just that the TypeScript compiled.
