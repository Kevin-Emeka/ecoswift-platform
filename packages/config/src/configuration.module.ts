import { Module } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { FeatureFlagService } from './feature-flag.service';

/**
 * Provides `ConfigurationService` and `FeatureFlagService`. Both depend on
 * `@ecoswift/database`'s `PrismaService` and `@ecoswift/cache`'s
 * `CacheService` — import `PrismaModule` and `CacheModule.forRoot()` once
 * in the app's `AppModule` (both `@Global()`), same composition rule as
 * `@ecoswift/resilience`/`@ecoswift/event-bus`/`@ecoswift/queue`.
 *
 * Distinct from Nest's own `@nestjs/config` `ConfigModule`/`ConfigService`
 * (env-var based, used for `JWT_SECRET`-style static config) — this module
 * is for the database-backed, staff-editable runtime configuration and
 * feature flags described in `docs/domain-architecture.md` § Configuration.
 * Both are legitimately in use side by side; they solve different problems.
 */
@Module({
  providers: [ConfigurationService, FeatureFlagService],
  exports: [ConfigurationService, FeatureFlagService],
})
export class ConfigurationModule {}
