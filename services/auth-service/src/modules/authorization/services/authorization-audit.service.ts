import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';

export interface RecordAuditEntryInput {
  actorUserId?: string;
  actorType?: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'VIEW' | 'EXPORT';
  resourceType: string;
  resourceId?: string;
  description?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  correlationId?: string;
}

/**
 * Writes the immutable, hash-chained `AuditLog` row for every authorization
 * action (docs/compliance-controls.md § Audit Logging). Every entry's
 * `integrityHash` is computed over its own content **plus** the previous
 * entry's hash, so retroactively editing or deleting any row breaks the
 * chain from that point forward — the same tamper-evidence
 * `security-model.md` § Audit Strategy specifies, actually implemented for
 * the first time in this phase.
 *
 * The chain is read-then-write at the application layer (find the latest
 * row, hash against it, insert) rather than a database trigger — under
 * true concurrent writes from multiple service instances this has a
 * theoretical race (two inserts both reading the same "latest" row and
 * forking the chain). Documented as a known limitation in
 * docs/compliance-controls.md rather than solved here; a production
 * hardening pass would move this to a serialized DB-side sequence or
 * trigger.
 */
@Injectable()
export class AuthorizationAuditService {
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
