# Ecoswift Bank — Schema Reference

**Phase 2B deliverable.** Table-by-table reference for all 69 models in [`prisma/schema.prisma`](../prisma/schema.prisma). For standards (UUID PKs, UTC timestamps, naming) see [`database-architecture.md`](database-architecture.md); for the ledger tables' internal logic see [`ledger-design.md`](ledger-design.md).

**Every model has, and this reference omits repeating per-table:** `id` (UUID, `gen_random_uuid()`), and `createdAt`/`updatedAt` (`timestamptz`) unless noted otherwise. `version` (optimistic lock) and `deletedAt` (soft delete) are called out explicitly per model since they're the exception, not the rule.

---

## Identity

### `User` (`users`)
The authentication identity. One `User` per login-capable actor (customer or staff); banking-specific data lives on `Customer`, personal-identity data on `Profile`.

| Field | Notes |
|---|---|
| `actorType` | `CUSTOMER` \| `STAFF` \| `SYSTEM` |
| `email`, `phone` | both unique |
| `emailVerifiedAt`, `phoneVerifiedAt` | nullable |
| `passwordHash` | never plaintext |
| `status` | `UserStatus` enum |
| `failedLoginAttempts`, `lockedUntil` | lockout tracking |
| `version` | optimistic lock |
| `deletedAt` | soft delete |

Relations: 1:1 `Profile`, 1:1 optional `Customer`, 1:N `Device`/`Session`/`OtpChallenge`/`TwoFactorCredential`/`UserRole`, plus back-references from nearly every "who did this" FK across the schema (`Transaction.initiatedBy`, `JournalEntry.createdBy`, `KycApplication.reviewedBy`, etc.).

### `Profile` (`profiles`)
Personal-identity data, 1:1 with `User`. Shared shape for both customer and staff users.

| Field | Notes |
|---|---|
| `firstName`, `middleName?`, `lastName` | |
| `dateOfBirth` | `date` |
| `nationalityId` | FK → `Country`, restrict |

### `Device` (`devices`)
A recognized client device. Unique on `(userId, deviceFingerprint)`.

| Field | Notes |
|---|---|
| `trustLevel` | `UNTRUSTED` \| `TRUSTED` |
| `trustedAt`, `lastSeenAt` | |

### `Session` (`sessions`)
An issued login session. Indexed on `(userId, status)` and `expiresAt`.

| Field | Notes |
|---|---|
| `accessTokenHash`, `refreshTokenHash` | hashes only, never raw tokens |
| `status` | `ACTIVE` \| `EXPIRED` \| `REVOKED` |
| `expiresAt`, `revokedAt`, `revokedReason` | |

### `OtpChallenge` (`otp_challenges`)
Indexed on `(userId, purpose, status)`.

| Field | Notes |
|---|---|
| `purpose` | `LOGIN` \| `PASSWORD_RESET` \| `TRANSACTION_CONFIRMATION` \| `TWO_FACTOR_ENROLLMENT` |
| `codeHash` | never raw code |
| `attempts` / `maxAttempts` | default 5 |
| `expiresAt` | |

### `TwoFactorCredential` (`two_factor_credentials`)
Unique on `(userId, method)`.

| Field | Notes |
|---|---|
| `method` | `TOTP` \| `SMS` \| `EMAIL` |
| `secretEncrypted` | application-layer encrypted, never plaintext |
| `isEnabled` | |

### `BackupCode` (`backup_codes`)
Single-use 2FA recovery codes, child of `TwoFactorCredential`, cascade delete.

### `Role` / `Permission` / `RolePermission` / `UserRole` (`roles`, `permissions`, `role_permissions`, `user_roles`)
Standard RBAC join structure. `Permission` is unique on `(resource, action)`. `UserRole` has two distinct FKs to `User` — the assignee (`userId`) and the assigner (`assignedBy`) — modeled as two named relations to avoid ambiguity. See `security-model.md` for the seeded 7-role catalog.

---

## Account Management

### `Customer` (`customers`)
The banking-specific extension of a `User`. `customerNumber` unique. Indexed on `tier`.

| Field | Notes |
|---|---|
| `customerNumber` | unique, human-facing |
| `tier` | `KycTier`: `TIER_0`–`TIER_3` |
| `status` | `ACTIVE` \| `INACTIVE` \| `DEACTIVATED` |
| `riskRating` | `Decimal(5,2)`, nullable |
| `version`, `deletedAt` | |

### `AccountType` (`account_types`)
Product catalog, not a fixed enum — see `database-architecture.md` § Extensible Catalogs.

| Field | Notes |
|---|---|
| `code` | unique |
| `allowsOverdraft` | drives the (intentionally not DB-enforced) overdraft rule — see `ledger-design.md` |
| `minimumOpeningBalance` | `Decimal(19,4)`, `CHECK >= 0` |

### `Account` (`accounts`)
The account **record**, not its balance — see `AccountBalance`/`LedgerAccount`. Unique `accountNumber`. Indexed on `customerId`, `status`.

| Field | Notes |
|---|---|
| `accountNumber` | unique, immutable, never reused |
| `status` | `AccountStatus` enum (fixed state machine — see `business-rules.md` § Account States) |
| `openedAt`, `closedAt` | |
| `version` | optimistic lock |

### `Currency` (`currencies`)
ISO 4217 catalog. `isoCode` unique, `CHAR(3)`.

### `Country` (`countries`)
ISO 3166-1 catalog. `isoCode` unique, `CHAR(2)`.

### `Beneficiary` (`beneficiaries`)
External payee, deliberately **not** FK'd to `Account` (beneficiaries are typically at other institutions). Soft-deletable. Indexed on `customerId`.

| Field | Notes |
|---|---|
| `accountNumber`, `bankName?`, `bankCode?` | plain strings, external |
| `status` | `PENDING_VERIFICATION` \| `ACTIVE` \| `BLOCKED` |

---

## Accounting / Ledger

Full design rationale in [`ledger-design.md`](ledger-design.md); reference summary here.

### `AccountCategory` (`account_categories`)
The 5 fundamental categories: `ASSET`/`LIABILITY`/`EQUITY`/`REVENUE`/`EXPENSE`, each with a `normalBalance` (`DEBIT`/`CREDIT`).

### `LedgerAccount` (`ledger_accounts`)
The chart of accounts. `code` unique. `customerAccountId` unique+nullable FK → `Account` (null for internal bank accounts like "Interest Income").

### `AccountBalance` (`account_balances`)
**Cache/projection only — see the non-negotiable rule in `ledger-design.md`.** Unique on both `accountId` and `ledgerAccountId`.

| Field | Notes |
|---|---|
| `availableBalance`, `currentBalance` | `Decimal(19,4)` |
| `lastJournalLineId` | projection watermark |
| `lastReconciledAt` | |
| `version` | optimistic lock — protects against concurrent posting races |

### `JournalEntry` (`journal_entries`)
Immutable (DB-enforced, see `ledger-design.md`). `journalNumber` unique. Self-referential `reversalOfJournalEntryId` (unique) for corrections. Indexed on `transactionId`, `financialPeriodId`.

### `JournalLine` (`journal_lines`)
Immutable, one row per debit/credit. Unique on `(journalEntryId, lineNumber)`. Indexed on `(ledgerAccountId, createdAt)`. `amount` always positive (`CHECK > 0`), `direction` carries sign meaning. **Deferred trigger enforces Σdebits = Σcredits per currency per entry** — see `ledger-design.md`.

### `FinancialPeriod` (`financial_periods`)
`name` unique (e.g. `"2026-07"`). `status`: `OPEN` → `CLOSED` → `LOCKED`. `CHECK (end_date >= start_date)`.

---

## Transactions

### `TransactionType` (`transaction_types`)
Extensible catalog (deposit, withdrawal, transfer, disbursement, etc.), not an enum.

### `Transaction` (`transactions`)
The record of any money movement. `transactionReference` and `idempotencyKey` both unique. Indexed on `status`, `sourceAccountId`, `destinationAccountId`, `createdAt`.

| Field | Notes |
|---|---|
| `amount` | `Decimal(19,4)`, `CHECK >= 0` |
| `status` | `TransactionStatus`: `INITIATED`→...→`COMPLETED`/`FAILED`/`REVERSED` |
| `idempotencyKey` | unique, nullable — required on transfer-initiating endpoints per `api-guidelines.md` |
| `metadata` | `Json?` |

### `TransferRequest` (`transfer_requests`)
1:1 extension of `Transaction` for transfer-specific fields. Two named relations to `Account` (source/destination), optional FK to `Beneficiary` for external transfers. **No `currencyId` of its own** — an earlier draft had one, duplicating `Transaction.currencyId` for the same money movement; removed as a normalization fix during the Phase 2B quality gate (currency is read via `transferRequest.transaction.currencyId`). `requestedAmount` *is* kept distinct from `Transaction.amount` — it captures pre-execution customer intent, which can legitimately differ from the final settled amount (fees, FX slippage), so that duplication is real information, not redundancy.

### `TransferLimit` (`transfer_limits`)
Scoped by any combination of `customerId?`/`accountId?`/`tier?`. `CHECK` enforces `perTransactionLimit ≤ dailyLimit ≤ monthlyLimit`, all positive.

### `TransferApproval` (`transfer_approvals`)
Maker-checker record. Two named relations to `User` (`makerId`, `checkerId`) — never the same person by policy (`security-model.md`), though that specific invariant is an application-layer check, not a DB constraint (comparing two nullable FK values for inequality doesn't cleanly express "must differ when both present" as a simple CHECK across a nullable column without excluding legitimate not-yet-checked rows).

### `FeeSchedule` (`fee_schedules`) / `TransactionFee` (`transaction_fees`)
Catalog (schedule) and applied-instance (charge) split, same pattern as other catalog/instance pairs in this schema.

### `ExchangeRate` (`exchange_rates`)
Two named relations to `Currency` (base/quote). Unique on `(baseCurrencyId, quoteCurrencyId, effectiveAt)`. `CHECK (rate > 0)`.

---

## Notifications

### `NotificationTemplate` (`notification_templates`)
Unique on `(code, locale)` — supports localization without a separate translation table.

### `Notification` (`notifications`)
Optional FKs to both `User` and `Customer` as recipient (a notification can target either, depending on whether it's account-scoped or session-scoped). Indexed on `(recipientUserId, status)`, `createdAt`.

### `EmailQueue` / `SmsQueue` / `PushQueue` (`email_queue`, `sms_queue`, `push_queue`)
Structurally identical channel-delivery tables (1:1 with `Notification`), kept separate rather than one polymorphic table because each channel's delivery metadata genuinely differs (`toAddress` vs `toNumber` vs `deviceId`) and a shared table would need a pile of channel-specific nullable columns instead.

### `AuditNotification` (`audit_notifications`)
Thin marker linking a `Notification` to the `AuditLog` entry that triggered it, flagging the non-suppressible security class (`business-rules.md` § Notification Triggers).

---

## KYC

### `KycApplication` (`kyc_applications`)
Indexed on `customerId`, `status`.

| Field | Notes |
|---|---|
| `tierRequested` | `KycTier` |
| `status` | `KycStatus`: `NOT_STARTED`→...→`APPROVED`/`REJECTED`/`RE_VERIFICATION_REQUIRED` |
| `riskScore` | `Decimal(5,2)`, nullable |

### `KycDocument` (`kyc_documents`)
`documentType` (`NATIONAL_ID`, `PASSPORT`, etc.), `verificationStatus` per-document.

### `VerificationResult` (`verification_results`)
One row per check performed (`checkType` is a free-text string, not an enum, since check types come from third-party verification providers and shouldn't require a migration to add a new one). `result`: `PASS`/`FAIL`/`MANUAL_REVIEW`.

### `ComplianceNote` (`compliance_notes`)
Free-text staff notes on a case, `isInternal` flag.

---

## Loans

### `LoanProduct` (`loan_products`)
`CHECK` constraints enforce `minAmount ≤ maxAmount` and `minTermMonths ≤ maxTermMonths`.

### `LoanApplication` (`loan_applications`)
Pre-approval workflow record. `status`: shares the `LoanStatus` enum with `Loan` (see `domain-architecture.md` § Risk #4 for why these are two separate aggregates/tables rather than one).

### `Loan` (`loans`)
Post-approval servicing record, 1:1 with its originating `LoanApplication`. `version` for optimistic locking (balance-adjacent concurrent writes). `CHECK (principalAmount > 0)`, `CHECK (outstandingPrincipal >= 0)`.

### `RepaymentPlan` (`repayment_plans`) / `RepaymentSchedule` (`repayment_schedules`)
Header + installment-line split. `RepaymentSchedule` unique on `(repaymentPlanId, installmentNumber)`, indexed on `(dueDate, status)`. `CHECK` on all four amount columns `>= 0`.

### `Collateral` (`collateral`)
`collateralType` enum, `status`: `PLEDGED`/`RELEASED`/`LIQUIDATED`.

---

## Savings

### `SavingsProduct` (`savings_products`)
Product catalog: `planType`, `interestRate`, `earlyWithdrawalPenaltyRate?`.

### `SavingsAccount` (`savings_accounts`)
Unique `linkedAccountId` (1:1 with its underlying `Account` for ledger purposes). `version` for optimistic locking. `CHECK (goalAmount > 0)` when present.

### `InterestRule` (`interest_rules`)
Tiered rate rules per `SavingsProduct` (`tierMinBalance`/`tierMaxBalance`/`rate`, date-ranged).

### `InterestPostingHistory` (`interest_posting_history`)
Every row backed by a `JournalEntry` (`journalEntryId`, nullable only because the FK is added after the posting is confirmed) — interest is never a direct balance mutation, per `business-rules.md`.

---

## Reporting

### `Statement` (`statements`) / `StatementRequest` (`statement_requests`)
Request/result split. `CHECK (periodEnd >= periodStart)` on both.

### `ReportJob` (`report_jobs`)
Generic job record for any `ReportType` (`STATEMENT`/`REGULATORY`/`TAX`/`INTERNAL_AUDIT`/`CUSTOM`). `parameters: Json?`.

### `AuditReport` (`audit_reports`)
1:1 extension of `ReportJob` for compliance/audit-specific reports.

---

## Audit

### `AuditLog` (`audit_logs`)
**Append-only** (DB-enforced, same trigger as the ledger — see `ledger-design.md`). Hash-chained: `integrityHash` + `previousHash` for tamper-evidence (`security-model.md` § Audit Strategy). Indexed on `actorUserId`, `(resourceType, resourceId)`, `createdAt`.

### `ActivityLog` (`activity_logs`)
Lightweight, high-volume, non-security-critical activity tracking — deliberately separate from `AuditLog` so the compliance-critical table isn't diluted by routine noise. Indexed on `(userId, createdAt)`.

### `SecurityEvent` (`security_events`)
Structured security signals (`LOGIN_SUCCESS`, `SUSPICIOUS_LOGIN`, `TWO_FA_DISABLED`, etc.). Indexed on `(userId, eventType)`, `createdAt`.

### `LoginHistory` (`login_history`)
Every login attempt, successful or not, with device/session linkage. Indexed on `(userId, loggedInAt)`.

---

## API

### `ApiKey` (`api_keys`)
`keyHash` unique (never the raw key at rest); `keyPrefix` for display purposes (`esb_live_xxxx`-style). `scopes: String[]`.

### `WebhookEndpoint` (`webhook_endpoints`)
Not explicitly named in the Phase 2B brief but structurally required — the registered-URL half of "Webhook Events/Deliveries." `secretHash` for payload signing.

### `WebhookEvent` (`webhook_events`)
Outbox-style record of an event eligible for delivery. Indexed on `(eventType, occurredAt)`.

### `WebhookDelivery` (`webhook_deliveries`)
One row per (event, endpoint) delivery attempt series. Indexed on `(status, nextRetryAt)` for the retry sweep query.

---

## Configuration

### `ApplicationSetting` (`application_settings`) / `SystemSetting` (`system_settings`)
Business/product config vs. lower-level system/infra toggles — see `database-architecture.md` § Future Improvements for the note that this split may warrant revisiting once real usage patterns are known. Both: `key` unique, `valueType` discriminator (`STRING`/`NUMBER`/`BOOLEAN`/`JSON`), `isSecret` flag on `ApplicationSetting` only (system settings aren't expected to hold secrets — real secrets belong in a secrets manager per `security-model.md`, not this table, regardless of the flag).

### `FeatureFlag` (`feature_flags`)
`scope` (`GLOBAL`/`CUSTOMER`/`STAFF`/`PRODUCT`) + optional `scopeReference` for non-global flags, `rolloutPercentage` for gradual rollout.

---

## Support

### `SupportCategory` (`support_categories`)
Simple named catalog.

### `SupportTicket` (`support_tickets`)
`ticketNumber` unique. Indexed on `customerId`, `status`, `ticketNumber`.

### `TicketMessage` (`ticket_messages`)
`authorType` (`CUSTOMER`/`STAFF`/`SYSTEM`) alongside nullable `authorId` — supports system-generated messages (auto-responses, status-change notices) without forcing a fake `User` row to exist for them.

---

## Enum Index

All ~40 enums are defined at the top of `prisma/schema.prisma`, grouped by module with a comment header matching this document's section order. See the schema file directly for the authoritative, always-in-sync member list — reproducing every enum's full value list here would just be a second copy that can drift from the source of truth, which is exactly the anti-pattern this whole schema tries to avoid (see `ledger-design.md` on why there's no separate "GeneralLedger" table for the same reason).
