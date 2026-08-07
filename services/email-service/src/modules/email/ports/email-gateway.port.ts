export interface SendEmailInput {
  toAddress: string;
  fromAddress: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
}

export interface SendEmailResult {
  providerMessageId?: string;
}

export interface EmailGatewayPort {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export const EMAIL_GATEWAY = Symbol('EMAIL_GATEWAY');
