export interface SendSmsInput {
  toNumber: string;
  message: string;
}

export interface SendSmsResult {
  providerMessageId?: string;
}

export interface SmsGatewayPort {
  send(input: SendSmsInput): Promise<SendSmsResult>;
}

export const SMS_GATEWAY = Symbol('SMS_GATEWAY');
