import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CAPTCHA_VERIFIER } from './captcha-verifier.port';
import { NoopCaptchaAdapter } from './noop-captcha.adapter';
import { RecaptchaAdapter } from './recaptcha.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    NoopCaptchaAdapter,
    RecaptchaAdapter,
    {
      provide: CAPTCHA_VERIFIER,
      useFactory: (configService: ConfigService, noop: NoopCaptchaAdapter, recaptcha: RecaptchaAdapter) => {
        const driver = configService.get<string>('captcha.driver') ?? 'noop';
        return driver === 'recaptcha' ? recaptcha : noop;
      },
      inject: [ConfigService, NoopCaptchaAdapter, RecaptchaAdapter],
    },
  ],
  exports: [CAPTCHA_VERIFIER],
})
export class CaptchaModule {}
