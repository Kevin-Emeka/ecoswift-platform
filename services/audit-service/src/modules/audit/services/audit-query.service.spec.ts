import { createHash } from 'node:crypto';
import { AuditQueryService } from './audit-query.service';
import type { PrismaService } from '@ecoswift/database';

function hashEntry(entry: {
  actorUserId?: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  previousHash?: string;
  createdAt: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        actorUserId: entry.actorUserId,
        actionType: entry.actionType,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        beforeState: entry.beforeState ?? null,
        afterState: entry.afterState ?? null,
        previousHash: entry.previousHash,
        createdAt: entry.createdAt,
      }),
    )
    .digest('hex');
}

describe('AuditQueryService', () => {
  let prisma: { auditLog: { count: jest.Mock; findMany: jest.Mock } };
  let service: AuditQueryService;

  beforeEach(() => {
    prisma = { auditLog: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } };
    service = new AuditQueryService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('paginates and maps rows, including the actor email', async () => {
      prisma.auditLog.count.mockResolvedValue(2);
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          actorUserId: 'user-1',
          actor: { email: 'a@example.com' },
          actorType: 'CUSTOMER',
          actionType: 'CREATE',
          resourceType: 'Account',
          resourceId: 'account-1',
          description: null,
          beforeState: null,
          afterState: null,
          ipAddress: null,
          integrityHash: 'hash1',
          previousHash: undefined,
          createdAt: new Date(),
        },
      ]);

      const result = await service.list({ page: 1, limit: 25 });
      expect(result.total).toBe(2);
      expect(result.items[0]!.actorEmail).toBe('a@example.com');
    });
  });

  describe('verifyChain', () => {
    it('reports valid for a correctly chained sequence', async () => {
      const createdAt1 = new Date('2026-01-01T00:00:00Z');
      const entry1Hash = hashEntry({ actorUserId: 'user-1', actionType: 'CREATE', resourceType: 'Account', resourceId: 'a1', previousHash: undefined, createdAt: createdAt1.toISOString() });

      const createdAt2 = new Date('2026-01-01T00:01:00Z');
      const entry2Hash = hashEntry({ actorUserId: 'user-1', actionType: 'UPDATE', resourceType: 'Account', resourceId: 'a1', previousHash: entry1Hash, createdAt: createdAt2.toISOString() });

      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', actorUserId: 'user-1', actionType: 'CREATE', resourceType: 'Account', resourceId: 'a1', beforeState: null, afterState: null, previousHash: undefined, integrityHash: entry1Hash, createdAt: createdAt1 },
        { id: 'log-2', actorUserId: 'user-1', actionType: 'UPDATE', resourceType: 'Account', resourceId: 'a1', beforeState: null, afterState: null, previousHash: entry1Hash, integrityHash: entry2Hash, createdAt: createdAt2 },
      ]);

      const result = await service.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.entriesChecked).toBe(2);
    });

    it('detects a tampered entry (recomputed hash does not match the stored one)', async () => {
      const createdAt1 = new Date('2026-01-01T00:00:00Z');
      const entry1Hash = hashEntry({ actorUserId: 'user-1', actionType: 'CREATE', resourceType: 'Account', resourceId: 'a1', previousHash: undefined, createdAt: createdAt1.toISOString() });

      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', actorUserId: 'user-1', actionType: 'CREATE', resourceType: 'Account', resourceId: 'a1', beforeState: null, afterState: null, previousHash: undefined, integrityHash: entry1Hash, createdAt: createdAt1 },
        // Tampered: resourceId changed after the hash was computed, so recomputing it will not match the stored integrityHash.
        { id: 'log-2', actorUserId: 'user-1', actionType: 'UPDATE', resourceType: 'Account', resourceId: 'TAMPERED', beforeState: null, afterState: null, previousHash: entry1Hash, integrityHash: 'stale-hash-from-before-tampering', createdAt: new Date('2026-01-01T00:01:00Z') },
      ]);

      const result = await service.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.brokenAtId).toBe('log-2');
    });

    it('detects a broken chain link (previousHash does not match the prior entry\'s hash)', async () => {
      const createdAt1 = new Date('2026-01-01T00:00:00Z');
      const entry1Hash = hashEntry({ actorUserId: 'user-1', actionType: 'CREATE', resourceType: 'Account', resourceId: 'a1', previousHash: undefined, createdAt: createdAt1.toISOString() });

      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', actorUserId: 'user-1', actionType: 'CREATE', resourceType: 'Account', resourceId: 'a1', beforeState: null, afterState: null, previousHash: undefined, integrityHash: entry1Hash, createdAt: createdAt1 },
        { id: 'log-2', actorUserId: 'user-1', actionType: 'UPDATE', resourceType: 'Account', resourceId: 'a1', beforeState: null, afterState: null, previousHash: 'wrong-previous-hash', integrityHash: 'whatever', createdAt: new Date('2026-01-01T00:01:00Z') },
      ]);

      const result = await service.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.brokenAtId).toBe('log-2');
    });

    it('reports valid with zero entries checked for an empty chain', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      const result = await service.verifyChain();
      expect(result).toEqual({ valid: true, entriesChecked: 0 });
    });
  });
});
