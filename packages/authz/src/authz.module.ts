import { Module } from '@nestjs/common';
import { ConfigurationModule } from '@ecoswift/config';
import { PERMISSION_RESOLVER } from './interfaces/permission-resolver.port';
import { API_KEY_VALIDATOR } from './interfaces/api-key-validator.port';
import { PermissionResolverService } from './services/permission-resolver.service';
import { ApiKeyValidatorService } from './services/api-key-validator.service';
import { PolicyEngineService } from './services/policy-engine.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { OwnershipGuard } from './guards/ownership.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { FeatureFlagGuard } from './guards/feature-flag.guard';

/**
 * Composes every authorization primitive this package provides. Depends on
 * `@ecoswift/database`'s `PrismaService` and `@ecoswift/cache`'s
 * `CacheService` (both `@Global()`, available anywhere already) plus
 * `@ecoswift/config`'s `ConfigurationModule` (NOT global — imported here
 * explicitly, same composition rule `packages/config/src/configuration.module.ts`
 * documents for every one of its other consumers).
 *
 * Import this once in a service's `AppModule` (or feature module) to get
 * `PolicyEngineService`, `PermissionsGuard`, `OwnershipGuard`, `ApiKeyGuard`,
 * and `FeatureFlagGuard` available for injection/`@UseGuards()`.
 */
@Module({
  imports: [ConfigurationModule],
  providers: [
    { provide: PERMISSION_RESOLVER, useClass: PermissionResolverService },
    { provide: API_KEY_VALIDATOR, useClass: ApiKeyValidatorService },
    PolicyEngineService,
    PermissionsGuard,
    OwnershipGuard,
    ApiKeyGuard,
    FeatureFlagGuard,
  ],
  exports: [PERMISSION_RESOLVER, API_KEY_VALIDATOR, PolicyEngineService, PermissionsGuard, OwnershipGuard, ApiKeyGuard, FeatureFlagGuard],
})
export class AuthzModule {}
