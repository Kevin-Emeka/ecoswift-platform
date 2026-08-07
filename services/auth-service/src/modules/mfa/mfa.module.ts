import { Module } from '@nestjs/common';
import { SecurityModule as EcoswiftSecurityModule, TotpService } from '@ecoswift/security';
import { AuthModule } from '../auth/auth.module';
import { SecurityModule } from '../security/security.module';
import { MfaController } from './controllers/mfa.controller';
import { MfaLoginController } from './controllers/mfa-login.controller';
import { StepUpController } from './controllers/step-up.controller';
import { BackupCodeService } from './services/backup-code.service';
import { MfaService } from './services/mfa.service';
import { StepUpService } from './services/step-up.service';
import { StepUpGuard } from './guards/step-up.guard';

/**
 * Phase 3C — Multi-Factor Authentication. See docs/mfa.md. Imports
 * `AuthModule` for `TokenService`/`OtpService`/`AuthNotificationService`
 * (MFA reuses Identity's existing OTP and notification infrastructure
 * rather than duplicating it) and `SecurityModule` for
 * `SecurityEventService`. `AuthModule` already exports `AuthService`
 * only — the domain services this module actually needs
 * (`TokenService`, `OtpService`, `AuthNotificationService`) are exported
 * from it too; see that module's own `exports` array.
 */
@Module({
  imports: [AuthModule, SecurityModule, EcoswiftSecurityModule],
  controllers: [MfaController, MfaLoginController, StepUpController],
  providers: [BackupCodeService, MfaService, StepUpService, StepUpGuard],
  exports: [MfaService, StepUpService],
})
export class MfaModule {}
