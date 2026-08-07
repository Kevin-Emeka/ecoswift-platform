import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';

export interface RecordAuditEntryInput {
  actorUserId?: string;
  actorType?: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT' | 'FREEZE' | 'UNFREEZE' | 'EXPORT' | 'VIEW';
  resourceType: string;
  resourceId?: string;
  description?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  correlationId?: string;
}

/**
 * account-service's copy of auth-service's `AuthorizationAuditService` —
 * same hash-chained, append-only `AuditLog` table (shared across every
 * service, one global chain), same read-then-write pattern and the same
 * documented race under true concurrent multi-instance writes
 * (docs/compliance-controls.md). Duplicated rather than shared, matching
 * the precedent set by this service's own `JwtStrategy`
 * (`modules/auth/strategies/jwt.strategy.ts`): each service owns its
 * cross-cutting glue rather than depending on `auth-service` directly.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditEntryInput): Promise<void> {
    const previous = await this.prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { integrityHash: true },
    });
    const previousHash = previous?.integrityHash;
    const createdAt = new Date();

    const integrityHash = this.computeHash({
      actorUserId: entry.actorUserId,
      actionType: entry.actionType,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      previousHash,
      createdAt: createdAt.toISOString(),
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        actorType: entry.actorType,
        actionType: entry.actionType,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        description: entry.description,
        beforeState: (entry.beforeState ?? undefined) as Prisma.InputJsonValue | undefined,
        afterState: (entry.afterState ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: entry.ipAddress,
        correlationId: entry.correlationId,
        previousHash,
        integrityHash,
        createdAt,
      },
    });
  }

  private computeHash(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
