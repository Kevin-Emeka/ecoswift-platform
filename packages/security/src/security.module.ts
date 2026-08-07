import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CaptchaModule } from './captcha/captcha.module';
import { EncryptionService } from './crypto/encryption.service';
import { FRAUD_HOOKS } from './fraud/fraud-hooks.port';
import { NoopFraudHooksService } from './fraud/noop-fraud-hooks.service';
import { CsrfService } from './csrf/csrf.service';
import { CsrfGuard } from './csrf/csrf.guard';
import { ApiSigningService } from './signing/api-signing.service';
import { TotpService } from './mfa/totp.service';

/**
 * Composes every `@ecoswift/security` primitive. Import once per service —
 * `EncryptionService`, `CAPTCHA_VERIFIER`, `FRAUD_HOOKS`, `CsrfService`,
 * `CsrfGuard`, and `ApiSigningService` become available for injection.
 * `ConfigModule` is imported here (not assumed global) so `EncryptionService`/
 * `CaptchaModule` can read `encryption.*`/`captcha.*` config regardless of
 * whether the consuming app's own `ConfigModule.forRoot()` was marked
 * global — `@nestjs/config`'s `ConfigModule` is idempotent/side-effect-free
 * to import more than once.
 */
@Module({
  imports: [ConfigModule, CaptchaModule],
  providers: [
    EncryptionService,
    { provide: FRAUD_HOOKS, useClass: NoopFraudHooksService },
    CsrfService,
    CsrfGuard,
    ApiSigningService,
    TotpService,
  ],
  exports: [EncryptionService, FRAUD_HOOKS, CsrfService, CsrfGuard, ApiSigningService, CaptchaModule, TotpService],
})
export class SecurityModule {}
