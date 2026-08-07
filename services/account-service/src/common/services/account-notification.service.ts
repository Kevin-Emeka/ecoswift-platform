import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { EMAIL_QUEUE, PUSH_QUEUE, SMS_QUEUE } from '@ecoswift/queue';
import type { QueuePort } from '@ecoswift/queue';
import type { EmailJobPayload, PushJobPayload, SmsJobPayload } from '@ecoswift/queue';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, NOTIFICATION_QUEUED } from '@ecoswift/event-bus';

export interface SendEmailInput {
  userId?: string;
  customerId?: string;
  toAddress: string;
  templateCode: string;
  variables: Record<string, string>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export interface SendSmsInput {
  userId?: string;
  customerId?: string;
  toNumber: string;
  templateCode: string;
  variables: Record<string, string>;
}

export interface SendPushInput {
  userId?: string;
  customerId?: string;
  templateCode: string;
  variables: Record<string, string>;
}

/**
 * account-service's copy of auth-service's `AuthNotificationService` —
 * same render-persist-enqueue pattern against the shared
 * `NotificationTemplate`/`Notification`/`EmailQueue`/`SmsQueue` schema and
 * the same named `@ecoswift/queue` queues, `producerContext:
 * 'account-service'` distinguishing this service's published events.
 * Adds `sendPush()` — the Phase 4A brief is the first phase to need a push
 * notification (`ACCOUNT_OPENED`), so no prior service needed it; there is
 * no `PushQueue` table to persist against (Phase 2B's schema only defined
 * `EmailQueue`/`SmsQueue`), so only the `Notification` audit row and the
 * `PushJobPayload` job are written — consistent with `PushJobPayload`
 * itself carrying no more than `title`/`body`/`deviceId`.
 */
@Injectable()
export class AccountNotificationService {
  private readonly logger = new Logger(AccountNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: QueuePort<EmailJobPayload>,
    @Inject(SMS_QUEUE) private readonly smsQueue: QueuePort<SmsJobPayload>,
    @Inject(PUSH_QUEUE) private readonly pushQueue: QueuePort<PushJobPayload>,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async sendEmail(input: SendEmailInput): Promise<void> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { code_locale: { code: input.templateCode, locale: 'en' } },
    });
    if (!template || !template.isActive) {
      this.logger.warn(`Email template "${input.templateCode}" not found or inactive — notification skipped`);
      return;
    }

    const subject = this.render(template.subjectTemplate ?? '', input.variables);
    const bodyHtml = this.render(template.bodyTemplate, input.variables);

    const notification = await this.prisma.notification.create({
      data: {
        recipientUserId: input.userId,
        recipientCustomerId: input.customerId,
        templateId: template.id,
        channel: 'EMAIL',
        priority: input.priority ?? 'NORMAL',
        status: 'QUEUED',
        renderedSubject: subject,
        renderedBody: bodyHtml,
      },
    });

    await this.prisma.emailQueue.create({
      data: { notificationId: notification.id, toAddress: input.toAddress, fromAddress: 'noreply@ecoswiftbank.com', subject, bodyHtml },
    });

    await this.emailQueue.enqueue({ notificationId: notification.id, toAddress: input.toAddress, subject, bodyHtml });
    await this.publishQueued(notification.id, 'EMAIL', input.templateCode, input.userId, input.customerId);
  }

  async sendSms(input: SendSmsInput): Promise<void> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { code_locale: { code: input.templateCode, locale: 'en' } },
    });
    if (!template || !template.isActive) {
      this.logger.warn(`SMS template "${input.templateCode}" not found or inactive — notification skipped`);
      return;
    }

    const message = this.render(template.bodyTemplate, input.variables);

    const notification = await this.prisma.notification.create({
      data: {
        recipientUserId: input.userId,
        recipientCustomerId: input.customerId,
        templateId: template.id,
        channel: 'SMS',
        priority: 'HIGH',
        status: 'QUEUED',
        renderedBody: message,
      },
    });

    await this.prisma.smsQueue.create({ data: { notificationId: notification.id, toNumber: input.toNumber, message } });
    await this.smsQueue.enqueue({ notificationId: notification.id, toNumber: input.toNumber, message });
    await this.publishQueued(notification.id, 'SMS', input.templateCode, input.userId, input.customerId);
  }

  async sendPush(input: SendPushInput): Promise<void> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { code_locale: { code: input.templateCode, locale: 'en' } },
    });
    if (!template || !template.isActive) {
      this.logger.warn(`Push template "${input.templateCode}" not found or inactive — notification skipped`);
      return;
    }

    const title = this.render(template.subjectTemplate ?? '', input.variables);
    const body = this.render(template.bodyTemplate, input.variables);

    const notification = await this.prisma.notification.create({
      data: {
        recipientUserId: input.userId,
        recipientCustomerId: input.customerId,
        templateId: template.id,
        channel: 'PUSH',
        priority: 'NORMAL',
        status: 'QUEUED',
        renderedSubject: title,
        renderedBody: body,
      },
    });

    await this.pushQueue.enqueue({ notificationId: notification.id, title, body });
    await this.publishQueued(notification.id, 'PUSH', input.templateCode, input.userId, input.customerId);
  }

  private async publishQueued(
    notificationId: string,
    channel: 'EMAIL' | 'SMS' | 'PUSH',
    templateCode: string,
    userId?: string,
    customerId?: string,
  ): Promise<void> {
    await this.eventPublisher.publish({
      eventType: NOTIFICATION_QUEUED,
      producerContext: 'account-service',
      payload: { notificationId, channel, templateCode, recipientUserId: userId, recipientCustomerId: customerId },
    });
  }

  private render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
      const value = Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : undefined;
      return value ?? match;
    });
  }
}
