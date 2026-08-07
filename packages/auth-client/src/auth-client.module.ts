import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Import once in a service's `AppModule` to get token verification
 * (secure-by-default, `@Public()` opt-out) with zero per-service
 * boilerplate. `JwtModule.register({})` is intentionally empty —
 * `JwtStrategy` passes its own `secretOrKey` explicitly, this service
 * never signs anything.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthClientModule {}
