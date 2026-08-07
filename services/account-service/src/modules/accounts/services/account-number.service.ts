import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '@ecoswift/database';

/**
 * Generates 10-digit account numbers: a 3-digit product-type prefix + 6
 * random digits + a Luhn (mod-10) check digit — see docs/account-numbering.md
 * for the full rationale. Structurally similar to auth-service's
 * `generateCustomerNumber()` (retry-on-collision against the unique
 * constraint, 5 attempts) but a fixed-width numeric format with a real
 * checksum, matching how real bank account numbers (e.g. Nigeria's NUBAN)
 * are validated client-side before ever hitting the database.
 */
@Injectable()
export class AccountNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stable per `AccountType.code` so the prefix is visually meaningful (e.g. every SAVINGS account starts `101`). */
  private prefixFor(accountTypeCode: string): string {
    const prefixes: Record<string, string> = {
      CURRENT: '100',
      SAVINGS: '101',
      FIXED_DEPOSIT: '102',
      BUSINESS: '103',
    };
    return prefixes[accountTypeCode] ?? '199';
  }

  async generate(accountTypeCode: string): Promise<string> {
    const prefix = this.prefixFor(accountTypeCode);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const body = prefix + String(randomInt(0, 1_000_000)).padStart(6, '0');
      const candidate = body + this.luhnCheckDigit(body);
      const existing = await this.prisma.account.findUnique({ where: { accountNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique account number');
  }

  /** Standard Luhn algorithm (ISO/IEC 7812-1) — the digit that makes the full number, doubled from the rightmost digit, sum to a multiple of 10. */
  luhnCheckDigit(digits: string): string {
    let sum = 0;
    let double = true; // rightmost digit of the *body* is doubled first
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let d = Number(digits[i]);
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    return String((10 - (sum % 10)) % 10);
  }

  isValidLuhn(accountNumber: string): boolean {
    if (!/^\d{10}$/.test(accountNumber)) return false;
    const body = accountNumber.slice(0, 9);
    const checkDigit = accountNumber.slice(9);
    return this.luhnCheckDigit(body) === checkDigit;
  }
}
