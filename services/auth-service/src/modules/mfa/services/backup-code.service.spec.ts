import { BackupCodeService } from './backup-code.service';
import type { PrismaService } from '@ecoswift/database';

describe('BackupCodeService', () => {
  let prisma: { backupCode: { createMany: jest.Mock; deleteMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock; count: jest.Mock } };
  let service: BackupCodeService;

  beforeEach(() => {
    prisma = {
      backupCode: {
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new BackupCodeService(prisma as unknown as PrismaService);
  });

  describe('generate', () => {
    it('generates the requested count of codes, each in XXXX-XXXX shape', async () => {
      const codes = await service.generate('cred-1', 10);
      expect(codes).toHaveLength(10);
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      }
    });

    it('generates codes that are all distinct from each other', async () => {
      const codes = await service.generate('cred-1', 10);
      expect(new Set(codes).size).toBe(10);
    });

    it('persists only hashes, never the plaintext codes', async () => {
      const codes = await service.generate('cred-1', 3);
      const createArgs = prisma.backupCode.createMany.mock.calls[0][0];
      const persistedHashes = createArgs.data.map((d: { codeHash: string }) => d.codeHash);
      for (const code of codes) {
        expect(persistedHashes).not.toContain(code);
      }
      expect(persistedHashes).toHaveLength(3);
    });
  });

  describe('consume', () => {
    it('returns false and touches nothing for an unknown code', async () => {
      prisma.backupCode.findFirst.mockResolvedValue(null);
      await expect(service.consume('cred-1', 'AAAA-BBBB')).resolves.toBe(false);
      expect(prisma.backupCode.update).not.toHaveBeenCalled();
    });

    it('marks a valid, unused code as used and returns true', async () => {
      prisma.backupCode.findFirst.mockResolvedValue({ id: 'code-1' });
      await expect(service.consume('cred-1', 'AAAA-BBBB')).resolves.toBe(true);
      expect(prisma.backupCode.update).toHaveBeenCalledWith({ where: { id: 'code-1' }, data: { usedAt: expect.any(Date) } });
    });

    it('normalizes whitespace and case before hashing/lookup', async () => {
      prisma.backupCode.findFirst.mockResolvedValue({ id: 'code-1' });
      await service.consume('cred-1', '  aaaa-bbbb  ');
      const lookupArgs = prisma.backupCode.findFirst.mock.calls[0][0];
      expect(lookupArgs.where.twoFactorCredentialId).toBe('cred-1');
      expect(lookupArgs.where.usedAt).toBeNull();
    });

    it('only matches codes not already used (query scoped to usedAt: null)', async () => {
      prisma.backupCode.findFirst.mockResolvedValue(null);
      await service.consume('cred-1', 'AAAA-BBBB');
      expect(prisma.backupCode.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ usedAt: null }) }),
      );
    });
  });

  describe('invalidateAll', () => {
    it('deletes every unused code for the credential', async () => {
      await service.invalidateAll('cred-1');
      expect(prisma.backupCode.deleteMany).toHaveBeenCalledWith({ where: { twoFactorCredentialId: 'cred-1', usedAt: null } });
    });
  });

  describe('remainingCount', () => {
    it('counts only unused codes', async () => {
      prisma.backupCode.count.mockResolvedValue(7);
      await expect(service.remainingCount('cred-1')).resolves.toBe(7);
      expect(prisma.backupCode.count).toHaveBeenCalledWith({ where: { twoFactorCredentialId: 'cred-1', usedAt: null } });
    });
  });
});
