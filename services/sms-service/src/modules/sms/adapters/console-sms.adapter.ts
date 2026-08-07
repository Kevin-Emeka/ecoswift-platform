import { Injectable, Logger } from '@nestjs/common';
import type { SendSmsInput, SendSmsResult, SmsGatewayPort } from '../ports/sms-gateway.port';

/** Default adapter for this sandbox/demo deployment (`SMS_DRIVER=console`). Logs a labeled line instead of sending anything real. */
@Injectable()
export class ConsoleSmsAdapter implements SmsGatewayPort {
  private readonly logger = new Logger(ConsoleSmsAdapter.name);

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    this.logger.log(`[SANDBOX] Simulated SMS to ${input.toNumber}: "${input.message}"`);
    return { providerMessageId: `sandbox-${Date.now()}` };
  }
}
