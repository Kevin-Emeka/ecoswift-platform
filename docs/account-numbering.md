# Ecoswift Bank — Account Numbering

**Phase 4A deliverable.** `AccountNumberService` (`services/account-service/src/modules/accounts/services/account-number.service.ts`). See [`account-opening.md`](account-opening.md) for where generation fits into the opening flow.

---

## Format

10 digits, three parts:

```
[3-digit product prefix][6 random digits][1 Luhn check digit]
 ─────────┬────────────  ────────┬──────   ──────┬──────────
      product type          entropy         checksum
```

| `AccountType.code` | Prefix |
|---|---|
| `CURRENT` | `100` |
| `SAVINGS` | `101` |
| `FIXED_DEPOSIT` | `102` |
| `BUSINESS` | `103` |
| *(any future type)* | `199` (fallback — see below) |

Example: `1019318292` — `101` (Savings) + `931829` + `2` (check digit).

This is deliberately close to a real 10-digit NUBAN-style account number (the format several African banks — a market this platform's currency catalog already reflects, with NGN/KES/GHS/ZAR seeded alongside USD/EUR/GBP) use in production, rather than an arbitrary internal id. The product prefix means an account number is visually meaningful at a glance (every Savings account starts `101`) without needing a database lookup — genuinely useful for support staff reading a number off a customer over the phone, not just decorative.

## Why a Luhn Check Digit

The Luhn algorithm (ISO/IEC 7812-1 — the same checksum credit card numbers use) catches the overwhelmingly common class of real-world account number errors: a single mistyped digit or two adjacent digits transposed. Validating the check digit **client-side, before a request ever reaches the server**, turns "customer mistyped a digit" from a confusing "account not found" into an immediate, precise "that account number isn't valid" — a materially better error experience for a field customers frequently type by hand (wiring instructions, beneficiary setup, support calls). `AccountNumberService.isValidLuhn()` is exposed specifically so a future phase's transfer/beneficiary-entry validation can reuse it without recomputing the algorithm.

It is **not** a security or fraud control — a Luhn check digit reveals nothing about whether an account genuinely exists, only whether a number is *structurally* well-formed. Real existence is always a database lookup.

## Generation & Uniqueness

```ts
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
```

Structurally identical to the retry-on-collision pattern `auth-service`'s `generateCustomerNumber()` established in Phase 3A (`ESB` + 9 random digits, up to 5 attempts against the unique constraint) — the same shape reused for a second, differently-formatted identifier rather than inventing a new generation strategy. `Account.accountNumber` carries its own DB-level `@unique` constraint as the actual correctness guarantee; the retry loop is what makes collisions vanishingly unlikely to ever require a caller-visible retry, not what makes uniqueness *correct* — that's the database's job, and would reject a genuine collision even if the loop somehow produced one.

With 6 random digits per prefix, a given product type has 1,000,000 possible bodies before any collision becomes likely at all (birthday-bound, so meaningfully fewer *before* a first collision is even odds — but still comfortably enough headroom for any realistic bank's customer base per product line before the 5-attempt retry budget would ever plausibly run out).

## Testing

`account-number.service.spec.ts` — every generated number matches `/^\d{10}$/` and passes its own Luhn check; the prefix is correct and stable per account type; a mocked 2-collision-then-success sequence resolves correctly and calls the uniqueness check exactly 3 times; an always-colliding mock exhausts all 5 attempts and throws; a tampered check digit (flip the last digit of a real, freshly-generated number) is correctly rejected by `isValidLuhn()`; malformed input (wrong length, non-numeric) is rejected. Live-verified in `account-opening.e2e-spec.ts` and via manual smoke testing — every account number produced by a real `POST /v1/accounts` call during this phase's development passed independent Luhn verification.
