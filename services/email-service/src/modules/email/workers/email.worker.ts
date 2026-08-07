import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions, Job } from 'bullmq';
import { BaseWorker, BULLMQ_CONNECTION, QUEUE_NAMES } from '@ecoswift/queue';
import type { EmailJobPayload } from '@ecoswift/queue';
import { PrismaService } from '@ecoswift/database';
import { EVENT_PUBLISHER, NOTIFICATION_SENT } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EMAIL_GATEWAY, type EmailGatewayPort } from '../ports/email-gateway.port';

/**
 * Consumes `EMAIL_QUEUE` — the second real queue consumer in this
 * platform (`docs/queues.md`'s `BaseWorker` had zero subclasses before
 * this milestone). Delivery goes through `EmailGatewayPort`
 * (`ConsoleEmailAdapter` by default — sandbox-safe — or `SmtpEmailAdapter`
 * when `EMAIL_DRIVER=smtp`), so this worker's job is purely: pull the job,
 * hand it to whichever gateway is configured, and record the outcome on
 * `EmailQueue`/`Notification`. On failure it re-throws so BullMQ's own
 * retry/backoff (configured producer-side, `BullMQQueueAdapter`) takes
 * over — this worker doesn't implement its own retry logic.
 */
@Injectable()
export class EmailWorker extends BaseWorker<EmailJobPayload> {
  protected readonly queueName = QUEUE_NAMES.EMAIL;

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: ConnectionOptions,
    private readonly prisma: PrismaService,
    @Inject(EMAIL_GATEWAY) private readonly gateway: EmailGatewayPort,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
    private readonly configService: ConfigService,
  ) {
    super(connection);
  }

  protected async process(job: Job<EmailJobPayload>): Promise<void> {
    const { notificationId, toAddress, subject, bodyHtml, bodyText } = job.data;

    await this.prisma.emailQueue.update({
      where: { notificationId },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });

    try {
      const result = await this.gateway.send({
        toAddress,
        fromAddress: this.configService.get<string>('smtp.from') ?? 'noreply@ecoswiftbank.com',
        subject,
        bodyHtml,
        bodyText,
      });

      await this.prisma.$transaction([
        this.prisma.emailQueue.update({
          where: { notificationId },
          data: { status: 'SENT', sentAt: new Date(), providerMessageId: result.providerMessageId },
        }),
        this.prisma.notification.update({ where: { id: notificationId }, data: { status: 'SENT', sentAt: new Date() } }),
      ]);

      await this.eventPublisher.publish({
        eventType: NOTIFICATION_SENT,
        producerContext: 'email-service',
        payload: { notificationId, channel: 'EMAIL', sentAt: new Date().toISOString() },
      });
    } catch (error) {
      await this.prisma.emailQueue.update({ where: { notificationId }, data: { status: 'FAILED' } });
      throw error;
    }
  }
}
