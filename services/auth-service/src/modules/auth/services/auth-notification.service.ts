import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { EMAIL_QUEUE, SMS_QUEUE } from '@ecoswift/queue';
import type { QueuePort } from '@ecoswift/queue';
import type { EmailJobPayload, SmsJobPayload } from '@ecoswift/queue';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, NOTIFICATION_QUEUED } from '@ecoswift/event-bus';

export interface SendEmailInput {
  userId?: string;
  customerId?: string;
  toAddress: string;
  templateCode: string;
  variables: Record<string, string>;
}

export interface SendSmsInput {
  userId?: string;
  customerId?: string;
  toNumber: string;
  templateCode: string;
  variables: Record<string, string>;
}

/**
 * The concrete "notification abstraction" usage this phase's brief asks
 * for: render a `NotificationTemplate` (Phase 2B schema, HTML bodies for
 * the 4 auth emails seeded from `prisma/templates/emails/*.html` — see
 * `docs/authentication.md` § Email Templates), persist the
 * `Notification`/`EmailQueue`/`SmsQueue` audit rows Phase 2B's schema
 * defines for exactly this, and enqueue onto Phase 2C's named queues
 * (`@ecoswift/queue`). Actually dispatching (an SMTP call, a Twilio call)
 * is deliberately **not** implemented here — that's `email-service`'s and
 * `sms-service`'s job (scaffolded in Phase 1, business logic for a later
 * phase) consuming these same queues; this phase's job is producing
 * correctly-shaped, correctly-audited jobs onto them.
 */
@Injectable()
export class AuthNotificationService {
  private readonly logger = new Logger(AuthNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: QueuePort<EmailJobPayload>,
    @Inject(SMS_QUEUE) private readonly smsQueue: QueuePort<SmsJobPayload>,
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
        priority: 'NORMAL',
        status: 'QUEUED',
        renderedSubject: subject,
        renderedBody: bodyHtml,
      },
    });

    await this.prisma.emailQueue.create({
      data: {
        notificationId: notification.id,
        toAddress: input.toAddress,
        fromAddress: 'noreply@ecoswiftbank.com',
        subject,
        bodyHtml,
      },
    });

    await this.emailQueue.enqueue({
      notificationId: notification.id,
      toAddress: input.toAddress,
      subject,
      bodyHtml,
    });

    await this.eventPublisher.publish({
      eventType: NOTIFICATION_QUEUED,
      producerContext: 'auth-service',
      payload: {
        notificationId: notification.id,
        channel: 'EMAIL',
        templateCode: input.templateCode,
        recipientUserId: input.userId,
        recipientCustomerId: input.customerId,
      },
    });
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

    await this.prisma.smsQueue.create({
      data: { notificationId: notification.id, toNumber: input.toNumber, message },
    });

    await this.smsQueue.enqueue({ notificationId: notification.id, toNumber: input.toNumber, message });

    await this.eventPublisher.publish({
      eventType: NOTIFICATION_QUEUED,
      producerContext: 'auth-service',
      payload: {
        notificationId: notification.id,
        channel: 'SMS',
        templateCode: input.templateCode,
        recipientUserId: input.userId,
        recipientCustomerId: input.customerId,
      },
    });
  }

  /** `{{variable}}` substitution — deliberately simple; these templates have no conditionals/loops that would justify a full template engine. */
  private render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
      const value = Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : undefined;
      return value ?? match;
    });
  }
}
