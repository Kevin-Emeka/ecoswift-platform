import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionOptions, Job } from 'bullmq';
import { BaseWorker, BULLMQ_CONNECTION, QUEUE_NAMES } from '@ecoswift/queue';
import type { SmsJobPayload } from '@ecoswift/queue';
import { PrismaService } from '@ecoswift/database';
import { EVENT_PUBLISHER, NOTIFICATION_SENT } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { SMS_GATEWAY, type SmsGatewayPort } from '../ports/sms-gateway.port';

/** Consumes `SMS_QUEUE` — same shape as `email-service`'s `EmailWorker`; see that class's doc comment for the design this mirrors. */
@Injectable()
export class SmsWorker extends BaseWorker<SmsJobPayload> {
  protected readonly queueName = QUEUE_NAMES.SMS;

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: ConnectionOptions,
    private readonly prisma: PrismaService,
    @Inject(SMS_GATEWAY) private readonly gateway: SmsGatewayPort,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {
    super(connection);
  }

  protected async process(job: Job<SmsJobPayload>): Promise<void> {
    const { notificationId, toNumber, message } = job.data;

    await this.prisma.smsQueue.update({
      where: { notificationId },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });

    try {
      const result = await this.gateway.send({ toNumber, message });

      await this.prisma.$transaction([
        this.prisma.smsQueue.update({
          where: { notificationId },
          data: { status: 'SENT', sentAt: new Date(), providerMessageId: result.providerMessageId },
        }),
        this.prisma.notification.update({ where: { id: notificationId }, data: { status: 'SENT', sentAt: new Date() } }),
      ]);

      await this.eventPublisher.publish({
        eventType: NOTIFICATION_SENT,
        producerContext: 'sms-service',
        payload: { notificationId, channel: 'SMS', sentAt: new Date().toISOString() },
      });
    } catch (error) {
      await this.prisma.smsQueue.update({ where: { notificationId }, data: { status: 'FAILED' } });
      throw error;
    }
  }
}
