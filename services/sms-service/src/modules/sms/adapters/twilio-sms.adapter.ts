import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendSmsInput, SendSmsResult, SmsGatewayPort } from '../ports/sms-gateway.port';

interface TwilioMessageResponse {
  sid: string;
}

/**
 * Real delivery via Twilio's REST API — used when `SMS_DRIVER=twilio` and
 * real credentials are configured. Calls Twilio directly over `fetch`
 * (Basic Auth, form-encoded body) rather than adding the full `twilio` SDK
 * as a dependency — the Messages resource is a single simple POST, and
 * this service otherwise defaults to the sandbox console adapter, so a
 * heavyweight SDK dependency isn't earning its weight for the one real
 * call site it would serve.
 */
@Injectable()
export class TwilioSmsAdapter implements SmsGatewayPort {
  private readonly logger = new Logger(TwilioSmsAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    const fromNumber = this.configService.get<string>('twilio.phoneNumber');

    if (!accountSid || !authToken || !fromNumber) {
      throw new InternalServerErrorException('Twilio credentials are not configured');
    }

    const body = new URLSearchParams({ To: input.toNumber, From: fromNumber, Body: input.message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(`Twilio send failed (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as TwilioMessageResponse;
    this.logger.log(`Sent SMS to ${input.toNumber} (Twilio sid: ${result.sid})`);
    return { providerMessageId: result.sid };
  }
}
