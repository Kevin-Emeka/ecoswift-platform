import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionOptions, Job } from 'bullmq';
import { BaseWorker, BULLMQ_CONNECTION, QUEUE_NAMES } from '@ecoswift/queue';
import type { PushJobPayload } from '@ecoswift/queue';
import { PrismaService } from '@ecoswift/database';

/**
 * Consumes `PUSH_QUEUE` — the first real consumer any queue in this
 * platform has had (`packages/queue`'s `BaseWorker` shipped in Phase 2C
 * with zero subclasses; see `docs/queues.md`). There is no real push
 * provider (FCM/APNs) wired up in this sandbox deployment — delivery is
 * simulated by marking the `Notification` row `SENT` and logging it,
 * clearly labeled as such, consistent with every other sandbox-only piece
 * of this milestone. The in-app Notification Center
 * (`NotificationCenterService`) is what actually surfaces the
 * notification to the user regardless of whether a "real" push
 * mechanism exists.
 */
@Injectable()
export class PushWorker extends BaseWorker<PushJobPayload> {
  protected readonly queueName = QUEUE_NAMES.PUSH;

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: ConnectionOptions,
    private readonly prisma: PrismaService,
  ) {
    super(connection);
  }

  protected async process(job: Job<PushJobPayload>): Promise<void> {
    this.logger.log(`[SANDBOX] Simulated push delivery: "${job.data.title}" — ${job.data.body}`);
    await this.prisma.notification.update({
      where: { id: job.data.notificationId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }
}
