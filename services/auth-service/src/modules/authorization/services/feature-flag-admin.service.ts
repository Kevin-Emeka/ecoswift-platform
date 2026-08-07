import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { FeatureFlagService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, FEATURE_FLAG_TOGGLED } from '@ecoswift/event-bus';
import { AuthorizationAuditService } from './authorization-audit.service';

export interface CreateFeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  isEnabled?: boolean;
  scope?: 'GLOBAL' | 'CUSTOMER' | 'STAFF' | 'PRODUCT';
  scopeReference?: string;
  rolloutPercentage?: number;
}

export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string;
  scope?: 'GLOBAL' | 'CUSTOMER' | 'STAFF' | 'PRODUCT';
  scopeReference?: string;
  rolloutPercentage?: number;
}

/**
 * CRUD for `FeatureFlag` rows — the "Feature Flags Integration" the Phase
 * 3B brief asks for. Evaluation (`isEnabled()`, rollout bucketing) is
 * already implemented by `@ecoswift/config`'s `FeatureFlagService` (Phase
 * 2C) and deliberately not duplicated here; this service is the write side
 * that service was never given, plus the cache-invalidation and audit
 * trail every other write in this module has.
 */
@Injectable()
export class FeatureFlagAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagService,
    private readonly audit: AuthorizationAuditService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async list() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async create(input: CreateFeatureFlagInput, actorUserId: string) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key: input.key } });
    if (existing) throw new ConflictException(`A feature flag with key "${input.key}" already exists`);

    const flag = await this.prisma.featureFlag.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description,
        isEnabled: input.isEnabled ?? false,
        scope: input.scope ?? 'GLOBAL',
        scopeReference: input.scopeReference,
        rolloutPercentage: input.rolloutPercentage,
        updatedBy: actorUserId,
      },
    });

    await this.audit.record({
      actorUserId,
      actionType: 'CREATE',
      resourceType: 'FEATURE_FLAG',
      resourceId: flag.id,
      description: `Feature flag "${flag.key}" created`,
      afterState: { key: flag.key, isEnabled: flag.isEnabled, scope: flag.scope },
    });

    return flag;
  }

  async update(id: string, input: UpdateFeatureFlagInput, actorUserId: string) {
    const flag = await this.assertExists(id);

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        scope: input.scope ?? undefined,
        scopeReference: input.scopeReference ?? undefined,
        rolloutPercentage: input.rolloutPercentage ?? undefined,
        updatedBy: actorUserId,
      },
    });
    await this.featureFlags.invalidate(flag.key);

    await this.audit.record({
      actorUserId,
      actionType: 'UPDATE',
      resourceType: 'FEATURE_FLAG',
      resourceId: id,
      description: `Feature flag "${flag.key}" updated`,
      beforeState: { scope: flag.scope, rolloutPercentage: flag.rolloutPercentage },
      afterState: { scope: updated.scope, rolloutPercentage: updated.rolloutPercentage },
    });

    return updated;
  }

  async toggle(id: string, isEnabled: boolean, actorUserId: string) {
    const flag = await this.assertExists(id);

    const updated = await this.prisma.featureFlag.update({ where: { id }, data: { isEnabled, updatedBy: actorUserId } });
    await this.featureFlags.invalidate(flag.key);

    await this.audit.record({
      actorUserId,
      actionType: 'UPDATE',
      resourceType: 'FEATURE_FLAG',
      resourceId: id,
      description: `Feature flag "${flag.key}" ${isEnabled ? 'enabled' : 'disabled'}`,
      beforeState: { isEnabled: flag.isEnabled },
      afterState: { isEnabled },
    });
    await this.eventPublisher.publish({
      eventType: FEATURE_FLAG_TOGGLED,
      producerContext: 'auth-service',
      payload: { featureFlagId: id, key: flag.key, isEnabled, toggledBy: actorUserId },
    });

    return updated;
  }

  private async assertExists(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }
}
