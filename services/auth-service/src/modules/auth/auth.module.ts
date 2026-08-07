import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigurationModule } from '@ecoswift/config';
import { AuthzModule } from '@ecoswift/authz';
import { SecurityModule as EcoswiftSecurityModule } from '@ecoswift/security';
import { SecurityModule } from '../security/security.module';
import { AuthController } from './controllers/auth.controller';
import { SessionsController } from './controllers/sessions.controller';
import { DevicesController } from './controllers/devices.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { OtpService } from './services/otp.service';
import { DeviceService } from './services/device.service';
import { LoginHistoryService } from './services/login-history.service';
import { AuthNotificationService } from './services/auth-notification.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Identity & Authentication (Phase 3A) — see docs/authentication.md,
 * docs/session-management.md, docs/security-overview.md.
 *
 * `JwtAuthGuard` is registered as an app-wide `APP_GUARD` here: every route
 * in the whole application requires authentication by default, opted out
 * of per-route with `@Public()` (`common/decorators/public.decorator.ts`).
 * `JwtModule.register({})` is intentionally empty — `TokenService` and
 * `JwtStrategy` both pass an explicit `secret` per call/strategy-instance
 * (`JWT_SECRET`/`JWT_REFRESH_SECRET`), so there's no single module-level
 * secret to configure here.
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), ConfigurationModule, AuthzModule, SecurityModule, EcoswiftSecurityModule],
  controllers: [AuthController, SessionsController, DevicesController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    OtpService,
    DeviceService,
    LoginHistoryService,
    AuthNotificationService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  // TokenService/OtpService/AuthNotificationService are exported for
  // `modules/mfa` (Phase 3C) to consume — MFA reuses Identity's existing
  // token/OTP/notification infrastructure rather than duplicating it.
  // `MfaModule` imports `AuthModule`; `AuthModule` never imports
  // `MfaModule` back — the MFA-enabled check `AuthService.login()` needs
  // is a direct `PrismaService` read, not a call into `MfaService`,
  // specifically so this dependency stays one-directional.
  exports: [AuthService, TokenService, OtpService, AuthNotificationService],
})
export class AuthModule {}
