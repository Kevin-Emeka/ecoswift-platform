import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailGatewayPort, SendEmailInput, SendEmailResult } from '../ports/email-gateway.port';

/** Real delivery via SMTP — used when `EMAIL_DRIVER=smtp` and real credentials are configured. */
@Injectable()
export class SmtpEmailAdapter implements EmailGatewayPort {
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('smtp.host'),
      port: this.configService.get<number>('smtp.port'),
      secure: this.configService.get<number>('smtp.port') === 465,
      auth: {
        user: this.configService.get<string>('smtp.user'),
        pass: this.configService.get<string>('smtp.password'),
      },
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const info = await this.transporter.sendMail({
      to: input.toAddress,
      from: input.fromAddress,
      subject: input.subject,
      html: input.bodyHtml,
      text: input.bodyText,
    });
    this.logger.log(`Sent email to ${input.toAddress} (message id: ${info.messageId})`);
    return { providerMessageId: info.messageId };
  }
}
