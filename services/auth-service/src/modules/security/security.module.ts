import { Module } from '@nestjs/common';
import { MetricsModule } from '@ecoswift/observability';
import { ConfigurationModule } from '@ecoswift/config';
import { AuthzModule } from '@ecoswift/authz';
import { SecurityEventService } from './services/security-event.service';
import { SuspiciousSessionDetectorService } from './services/suspicious-session-detector.service';
import { SecurityEventQueryService } from './services/security-event-query.service';
import { SecurityEventsController } from './controllers/security-events.controller';

/**
 * Shared security observability primitives (`SecurityEventService`,
 * `SuspiciousSessionDetectorService`) used by `modules/mfa`, `modules/auth`'s
 * device/session code, and anything else in this service that needs to
 * record a `SecurityEvent`. Imports `MetricsModule`/`ConfigurationModule`
 * directly — neither is `@Global()`, so every consumer composes them
 * explicitly (the same composition rule
 * `packages/config/src/configuration.module.ts` documents for its own
 * consumers).
 */
@Module({
  imports: [MetricsModule, ConfigurationModule, AuthzModule],
  controllers: [SecurityEventsController],
  providers: [SecurityEventService, SuspiciousSessionDetectorService, SecurityEventQueryService],
  exports: [SecurityEventService, SuspiciousSessionDetectorService],
})
export class SecurityModule {}
