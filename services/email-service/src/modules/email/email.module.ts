import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_GATEWAY } from './ports/email-gateway.port';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { SmtpEmailAdapter } from './adapters/smtp-email.adapter';
import { EmailWorker } from './workers/email.worker';

@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleEmailAdapter,
    SmtpEmailAdapter,
    {
      provide: EMAIL_GATEWAY,
      useFactory: (configService: ConfigService, console_: ConsoleEmailAdapter, smtp: SmtpEmailAdapter) => {
        const driver = configService.get<string>('email.driver') ?? 'console';
        return driver === 'smtp' ? smtp : console_;
      },
      inject: [ConfigService, ConsoleEmailAdapter, SmtpEmailAdapter],
    },
    EmailWorker,
  ],
})
export class EmailModule {}
