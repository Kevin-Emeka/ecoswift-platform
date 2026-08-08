import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_GATEWAY } from './ports/email-gateway.port';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { SmtpEmailAdapter } from './adapters/smtp-email.adapter';
import { ResendApiEmailAdapter } from './adapters/resend-api-email.adapter';
import { EmailWorker } from './workers/email.worker';

@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleEmailAdapter,
    SmtpEmailAdapter,
    ResendApiEmailAdapter,
    {
      provide: EMAIL_GATEWAY,
      useFactory: (
        configService: ConfigService,
        console_: ConsoleEmailAdapter,
        smtp: SmtpEmailAdapter,
        resendApi: ResendApiEmailAdapter,
      ) => {
        const driver = configService.get<string>('email.driver') ?? 'console';
        if (driver === 'resend') return resendApi;
        if (driver === 'smtp') return smtp;
        return console_;
      },
      inject: [ConfigService, ConsoleEmailAdapter, SmtpEmailAdapter, ResendApiEmailAdapter],
    },
    EmailWorker,
  ],
})
export class EmailModule {}
