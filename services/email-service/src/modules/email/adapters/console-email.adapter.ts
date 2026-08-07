import { Injectable, Logger } from '@nestjs/common';
import type { EmailGatewayPort, SendEmailInput, SendEmailResult } from '../ports/email-gateway.port';

/**
 * Default adapter for this sandbox/demo deployment (`EMAIL_DRIVER=console`,
 * the default — see `.env`'s comment on why). Logs a clearly-labeled line
 * instead of sending anything real; never throws, since a demo deployment
 * failing to "send" mail shouldn't ever fail the underlying job.
 */
@Injectable()
export class ConsoleEmailAdapter implements EmailGatewayPort {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const body = input.bodyText ?? input.bodyHtml ?? '(no body)';
    this.logger.log(
      `[SANDBOX] Simulated email to ${input.toAddress} — subject: "${input.subject}"\n${body}`,
    );
    return { providerMessageId: `sandbox-${Date.now()}` };
  }
}
