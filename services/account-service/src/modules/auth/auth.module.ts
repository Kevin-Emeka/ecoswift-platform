import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * account-service's authentication layer — verification only (auth-service
 * issues tokens; this only validates them). `JwtModule.register({})` is
 * intentionally empty, same reason as auth-service: `JwtStrategy` passes
 * its own `secretOrKey` explicitly. `JwtAuthGuard` is registered as an
 * app-wide `APP_GUARD` here (not in `app.module.ts`) — every route
 * requires authentication by default, `@Public()` opts out — same
 * composition as auth-service's own `AuthModule`.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
