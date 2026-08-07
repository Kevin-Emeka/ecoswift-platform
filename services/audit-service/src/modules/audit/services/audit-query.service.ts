import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import type { PaginatedResult } from '@ecoswift/types';
import type { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import type { AuditLogResponseDto } from '../dto/audit-log-response.dto';

export interface ChainVerificationResult {
  valid: boolean;
  entriesChecked: number;
  brokenAtId?: string;
}

/**
 * A pure read API over the `AuditLog` table every other service writes to
 * synchronously (`AuthorizationAuditService` in auth-service,
 * `AuditService` in account-service — both append-only, hash-chained,
 * global chain, per docs/compliance-controls.md). audit-service does not
 * consume `AUDIT_LOGS_QUEUE` — nothing in the platform actually produces
 * onto that queue today, because audit-log integrity depends on being
 * written in the same transaction/request as the action it records, not
 * asynchronously; a queued write would let the actual event and its audit
 * trail drift out of order. This service exists to let staff *query* what
 * every other service already wrote, not to write it.
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsQueryDto): Promise<PaginatedResult<AuditLogResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where: Prisma.AuditLogWhereInput = {
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorUserId: query.actorUserId,
      actionType: query.actionType as Prisma.AuditLogWhereInput['actionType'],
      createdAt:
        query.from || query.to
          ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
          : undefined,
    };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true } } },
      }),
    ]);

    const items: AuditLogResponseDto[] = logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId ?? undefined,
      actorEmail: log.actor?.email,
      actorType: log.actorType ?? undefined,
      actionType: log.actionType,
      resourceType: log.resourceType,
      resourceId: log.resourceId ?? undefined,
      description: log.description ?? undefined,
      beforeState: log.beforeState ?? undefined,
      afterState: log.afterState ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      integrityHash: log.integrityHash,
      previousHash: log.previousHash ?? undefined,
      createdAt: log.createdAt.toISOString(),
    }));

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /**
   * Walks the entire chain in creation order, recomputing each entry's
   * hash from its own content plus the previous entry's stored hash, and
   * confirms it matches what was persisted. The same computation
   * `AuthorizationAuditService`/`AuditService` use to produce
   * `integrityHash` in the first place — see those classes' doc comments
   * for the documented, accepted race under concurrent writes.
   */
  async verifyChain(): Promise<ChainVerificationResult> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        actorUserId: true,
        actionType: true,
        resourceType: true,
        resourceId: true,
        beforeState: true,
        afterState: true,
        previousHash: true,
        integrityHash: true,
        createdAt: true,
      },
    });

    let priorHash: string | undefined;
    for (const log of logs) {
      if (log.previousHash !== priorHash) {
        return { valid: false, entriesChecked: logs.indexOf(log), brokenAtId: log.id };
      }
      const expectedHash = createHash('sha256')
        .update(
          JSON.stringify({
            actorUserId: log.actorUserId,
            actionType: log.actionType,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            beforeState: log.beforeState,
            afterState: log.afterState,
            previousHash: log.previousHash,
            createdAt: log.createdAt.toISOString(),
          }),
        )
        .digest('hex');

      if (expectedHash !== log.integrityHash) {
        return { valid: false, entriesChecked: logs.indexOf(log), brokenAtId: log.id };
      }
      priorHash = log.integrityHash;
    }

    return { valid: true, entriesChecked: logs.length };
  }
}
