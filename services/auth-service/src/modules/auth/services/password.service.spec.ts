import { PasswordService } from './password.service';
import type { PrismaService } from '@ecoswift/database';
import type { ConfigurationService } from '@ecoswift/config';

describe('PasswordService', () => {
  let prisma: { passwordHistory: { findMany: jest.Mock; create: jest.Mock; deleteMany: jest.Mock } };
  let configurationService: { getNumber: jest.Mock; getBoolean: jest.Mock };
  let service: PasswordService;

  beforeEach(() => {
    prisma = {
      passwordHistory: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    configurationService = {
      getNumber: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
      getBoolean: jest.fn().mockImplementation((_key: string, fallback: boolean) => Promise.resolve(fallback)),
    };
    service = new PasswordService(prisma as unknown as PrismaService, configurationService as unknown as ConfigurationService);
  });

  describe('hash / verify', () => {
    it('produces an Argon2id hash that verify() accepts for the original plaintext', async () => {
      const hash = await service.hash('CorrectHorseBattery!9');
      expect(hash).toMatch(/^\$argon2id\$/);
      await expect(service.verify(hash, 'CorrectHorseBattery!9')).resolves.toBe(true);
    });

    it('rejects the wrong plaintext against a real hash', async () => {
      const hash = await service.hash('CorrectHorseBattery!9');
      await expect(service.verify(hash, 'WrongPassword!1')).resolves.toBe(false);
    });

    it('treats a malformed/foreign hash as a non-match rather than throwing', async () => {
      await expect(service.verify('not-an-argon2-hash', 'anything')).resolves.toBe(false);
    });
  });

  describe('validateComplexity', () => {
    it('returns no violations for a password satisfying every configured rule', async () => {
      const violations = await service.validateComplexity('Str0ng!Passw0rd');
      expect(violations).toEqual([]);
    });

    it('flags every missing character class independently', async () => {
      const violations = await service.validateComplexity('alllowercase');
      const rules = violations.map((v) => v.rule);
      expect(rules).toEqual(expect.arrayContaining(['uppercase', 'number', 'symbol']));
      expect(rules).not.toContain('lowercase');
    });

    it('flags min_length using the configured threshold, not the hardcoded default', async () => {
      configurationService.getNumber.mockImplementation((key: string, fallback: number) =>
        Promise.resolve(key === 'password.min_length' ? 20 : fallback),
      );
      const violations = await service.validateComplexity('Str0ng!Pass1');
      expect(violations.map((v) => v.rule)).toContain('min_length');
    });

    it('skips a rule entirely when its configuration flag is disabled', async () => {
      configurationService.getBoolean.mockImplementation((key: string, fallback: boolean) =>
        Promise.resolve(key === 'password.require_symbol' ? false : fallback),
      );
      const violations = await service.validateComplexity('Str0ngPassword1');
      expect(violations.map((v) => v.rule)).not.toContain('symbol');
    });
  });

  describe('isReusedPassword', () => {
    it('returns false when history is empty', async () => {
      await expect(service.isReusedPassword('user-1', 'anything')).resolves.toBe(false);
    });

    it('returns true when the candidate matches a stored history hash', async () => {
      const priorHash = await service.hash('OldPassword!1');
      prisma.passwordHistory.findMany.mockResolvedValue([{ passwordHash: priorHash }]);
      await expect(service.isReusedPassword('user-1', 'OldPassword!1')).resolves.toBe(true);
    });

    it('returns false when the candidate matches none of the stored hashes', async () => {
      const priorHash = await service.hash('OldPassword!1');
      prisma.passwordHistory.findMany.mockResolvedValue([{ passwordHash: priorHash }]);
      await expect(service.isReusedPassword('user-1', 'BrandNewPassword!2')).resolves.toBe(false);
    });

    it('skips the history check entirely when history_count is configured to 0', async () => {
      configurationService.getNumber.mockResolvedValue(0);
      await service.isReusedPassword('user-1', 'anything');
      expect(prisma.passwordHistory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('recordPasswordHistory', () => {
    it('creates a history row and prunes entries beyond the retention window', async () => {
      configurationService.getNumber.mockResolvedValue(5);
      prisma.passwordHistory.findMany.mockResolvedValue([{ id: 'excess-1' }, { id: 'excess-2' }]);

      await service.recordPasswordHistory('user-1', 'some-hash');

      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', passwordHash: 'some-hash' },
      });
      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['excess-1', 'excess-2'] } },
      });
    });

    it('does not call deleteMany when there is nothing beyond the retention window', async () => {
      configurationService.getNumber.mockResolvedValue(5);
      prisma.passwordHistory.findMany.mockResolvedValue([]);

      await service.recordPasswordHistory('user-1', 'some-hash');

      expect(prisma.passwordHistory.deleteMany).not.toHaveBeenCalled();
    });
  });
});
