import { AccountNumberService } from './account-number.service';
import type { PrismaService } from '@ecoswift/database';

describe('AccountNumberService', () => {
  let prisma: { account: { findUnique: jest.Mock } };
  let service: AccountNumberService;

  beforeEach(() => {
    prisma = { account: { findUnique: jest.fn() } };
    service = new AccountNumberService(prisma as unknown as PrismaService);
  });

  it('generates a 10-digit number with a valid Luhn check digit', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    const accountNumber = await service.generate('SAVINGS');
    expect(accountNumber).toMatch(/^\d{10}$/);
    expect(service.isValidLuhn(accountNumber)).toBe(true);
  });

  it('uses a stable, product-specific prefix per account type', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    expect((await service.generate('SAVINGS')).startsWith('101')).toBe(true);
    expect((await service.generate('CURRENT')).startsWith('100')).toBe(true);
    expect((await service.generate('FIXED_DEPOSIT')).startsWith('102')).toBe(true);
    expect((await service.generate('BUSINESS')).startsWith('103')).toBe(true);
  });

  it('retries on a collision and returns the first unique candidate', async () => {
    prisma.account.findUnique
      .mockResolvedValueOnce({ id: 'existing-1' })
      .mockResolvedValueOnce({ id: 'existing-2' })
      .mockResolvedValueOnce(null);

    const accountNumber = await service.generate('SAVINGS');
    expect(accountNumber).toMatch(/^\d{10}$/);
    expect(prisma.account.findUnique).toHaveBeenCalledTimes(3);
  });

  it('gives up after 5 collisions rather than looping forever', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'always-exists' });
    await expect(service.generate('SAVINGS')).rejects.toThrow('Could not generate a unique account number');
    expect(prisma.account.findUnique).toHaveBeenCalledTimes(5);
  });

  it('rejects a tampered check digit', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    const valid = await service.generate('SAVINGS');
    const lastDigit = Number(valid[valid.length - 1]);
    const tampered = valid.slice(0, -1) + String((lastDigit + 1) % 10);
    expect(service.isValidLuhn(tampered)).toBe(false);
  });

  it('rejects malformed input (wrong length, non-numeric)', () => {
    expect(service.isValidLuhn('123')).toBe(false);
    expect(service.isValidLuhn('abcdefghij')).toBe(false);
  });
});
