import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SMS_GATEWAY } from './ports/sms-gateway.port';
import { ConsoleSmsAdapter } from './adapters/console-sms.adapter';
import { TwilioSmsAdapter } from './adapters/twilio-sms.adapter';
import { SmsWorker } from './workers/sms.worker';

@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleSmsAdapter,
    TwilioSmsAdapter,
    {
      provide: SMS_GATEWAY,
      useFactory: (configService: ConfigService, console_: ConsoleSmsAdapter, twilio: TwilioSmsAdapter) => {
        const driver = configService.get<string>('sms.driver') ?? 'console';
        return driver === 'twilio' ? twilio : console_;
      },
      inject: [ConfigService, ConsoleSmsAdapter, TwilioSmsAdapter],
    },
    SmsWorker,
  ],
})
export class SmsModule {}
