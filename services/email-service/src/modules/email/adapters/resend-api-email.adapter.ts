import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailGatewayPort, SendEmailInput, SendEmailResult } from '../ports/email-gateway.port';

/**
 * Real delivery via Resend's HTTPS API — used when `EMAIL_DRIVER=resend`.
 * Deliberately not SMTP: many hosts (including this platform's free-tier
 * deployment target) block outbound SMTP ports (587/465/25) by default to
 * curb spam abuse, which manifests as `SmtpEmailAdapter` timing out on
 * every send with no way to fix it from application config. Resend's API
 * runs over plain HTTPS (443), which is essentially never blocked —
 * this is Resend's own recommended integration path for exactly this
 * class of host. Reuses `SMTP_PASSWORD` as the API key (it already holds
 * the Resend API key value in every environment that configured SMTP
 * delivery) rather than introducing a second secret to keep in sync.
 */
@Injectable()
export class ResendApiEmailAdapter implements EmailGatewayPort {
  private readonly logger = new Logger(ResendApiEmailAdapter.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('smtp.password') ?? '';
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.fromAddress,
        to: [input.toAddress],
        subject: input.subject,
        html: input.bodyHtml,
        text: input.bodyText,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error (${response.status}): ${body}`);
    }

    const result = (await response.json()) as { id: string };
    this.logger.log(`Sent email to ${input.toAddress} (message id: ${result.id})`);
    return { providerMessageId: result.id };
  }
}
