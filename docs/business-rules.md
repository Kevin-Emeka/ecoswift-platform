# Ecoswift Bank — Business Rules

**Phase 2A deliverable.** Declarative business rules per domain, referencing the aggregates and policies defined in [`domain-architecture.md`](domain-architecture.md). These are rules, not implementations — no calculation logic, no schema, no code. Interest math in particular is deliberately left high-level per the Phase 2A brief; exact formulas are a Phase 2B/3 concern.

Each rule is written so it can later become a `Specification` or `Policy` check (named where one already exists in the domain model) without re-deriving intent from scratch.

---

## Customer Registration (Customer Management)

- A `Customer` must have a unique, verifiable email **or** phone number at registration; at least one is mandatory, both are strongly recommended.
- Registration alone does not grant transaction capability — a `Customer` starts in an unverified state until `EmailVerified`/`PhoneVerified` and, separately, KYC clearance.
- Duplicate registration attempts (same government ID, or same verified email/phone already attached to an active `Customer`) are rejected by `DeduplicationService`, not silently merged.
- A `CustomerId` is immutable for the life of the customer relationship, even across profile edits, tier changes, or re-KYC.
- `IsProfileCompleteSpec` must pass (name, DOB, nationality, primary contact, primary address) before a customer can proceed to KYC submission.

## Login & Session (Identity & Access)

- Authentication requires a valid `Credential` match; a `UserAccount` is 1:1 with either a `Customer` or a `StaffMember`, never both.
- Failed login attempts are counted per `UserAccount` within a rolling window; exceeding the threshold triggers `LockoutPolicy` and emits `UserLockedOut` — the account is not unlocked by another login attempt, only by the explicit unlock flow.
- A successful login from a previously untrusted `Device` is a step-up trigger (see `security-model.md`), not an automatic session grant.
- See **Session Policy** and **Password Policy** below for lifecycle detail.

## Session Policy

- Sessions have both a **sliding inactivity timeout** and an **absolute maximum lifetime**; whichever is reached first ends the session.
- A refreshed session receives a new session token; the prior token is invalidated (no token reuse after refresh).
- Logging out, or an administrator/compliance-triggered force-logout, revokes the session immediately — revocation must take effect on the very next request, not just on next refresh.
- Concurrent session limits are configurable per risk tier via Configuration (`ConfigScope: identity`), not hardcoded.

## Password Policy

- Minimum complexity (length + character-class mix) is enforced by `IsPasswordCompliantSpec`, sourced from Configuration so it can be strengthened without a deploy.
- A new password must not match any of the customer's last N passwords (`PasswordRotationPolicy`).
- Password reset always invalidates all existing sessions for that `UserAccount` — a stolen session shouldn't survive a password reset.
- Password reset requires possession-based verification (email link or OTP), never a security question alone.

## KYC Requirements (KYC)

- No `BankAccount` beyond a restricted, low-limit tier may be opened while the linked `KycCase` is not `Approved`.
- KYC tiers gate capability, not just a boolean pass/fail: `TierLevel` determines maximum balance, maximum daily transfer, and whether Loans/Savings products are available to that customer.
- A `KycCase` moving to `Approved` requires every mandatory `VerificationCheck` for that tier to pass **and** a clean `SanctionsScreeningService` result — a single failed mandatory check blocks approval regardless of the others.
- KYC is not a one-time event: `ReVerificationPolicy` defines a periodic re-check cadence (and immediate re-check triggers, e.g. a sanctions list update matching an existing customer).
- A rejected `KycCase` must record a reason; silent rejection is not permitted (feeds both customer communication and audit).

## Account Creation (Account Management)

- `IsEligibleForOpeningSpec` requires: profile complete, KYC tier sufficient for the requested `AccountType`, and no active `AccountFreezePolicy` block on the customer from a prior account.
- Each `BankAccount` is opened with exactly one `Currency`; multi-currency is modeled as multiple accounts, not one account with multiple balances.
- An `AccountNumber` is assigned at creation and is immutable and non-reusable, even after account closure.
- An account cannot be opened directly into a `Frozen` or `Closed` state — those are only reachable transitions from `Active`.

## Account States

- Valid states: `PendingActivation → Active ⇄ Frozen → Dormant → Closed`, plus `Active → Closed` directly (dormancy is not mandatory before closure).
- `PendingActivation → Active` requires the account's opening conditions to still hold at activation time (KYC not since revoked, no fraud hold raised during the gap).
- `Active ⇄ Frozen` is reversible and can be triggered by: customer request, Support escalation, Compliance action, or an automated fraud/risk signal — the trigger source is always recorded (`Actor`), an account is never frozen with an anonymous cause.
- `DormancyPolicy` moves an account `Active → Dormant` after a configured period of no customer-initiated activity; a dormant account can still receive credits but customer-initiated debits require a reactivation step.
- `Closed` is terminal. A closed account cannot be reopened; a new account must be opened instead. Closure is only permitted when `AccountBalance` is exactly zero (`CanCloseAccountSpec`) — no closing an account into a residual balance, positive or negative.

## Balance Rules (Ledger)

- `AccountBalance` is never written directly — it is always derived from summing `Posting`s in the `JournalEntry` log for that account (CQRS: Ledger is the only context allowed to assert what a balance is).
- Every `JournalEntry` must satisfy `IsBalancedEntrySpec`: the sum of debit postings equals the sum of credit postings, in the same currency, before it is accepted — an unbalanced entry is rejected at construction, it can never exist even transiently.
- Postings are immutable once written. Correcting a mistake means posting a new, compensating reversal entry that references the original — never editing or deleting history (`PostingPolicy`).
- Whether an account may go negative (overdraft) is a per-`AccountType`/tier configuration, not a global rule; the default assumption for standard accounts is **no overdraft** unless explicitly enabled for that product.
- Currency conversion never happens implicitly inside a posting; a cross-currency movement is modeled as two same-currency postings plus an explicit FX conversion record (`CurrencyConsistencyPolicy`).

## Transfer Validation (Payments & Transfers)

- A `TransferOrder` must pass, in order: destination validity (`IsDestinationValidSpec`), sufficient funds at the source (`HasSufficientFundsSpec`), and applicable limit checks — failing any one stops the transfer before any Ledger posting is attempted.
- A transfer that fails limit/fraud checks is recorded as `TransferFailed` with a reason; it is not silently dropped, since Reporting and the customer both need to see a definitive outcome.
- Every `POST /transfers` request requires a client-supplied idempotency key; retried requests with the same key return the original outcome and never cause a duplicate posting.
- A transfer is only reported `TransferCompleted` after the corresponding `JournalEntry` is confirmed posted — "money moved" and "the ledger agrees money moved" are never allowed to diverge.
- Reversal of a completed transfer is itself a new transfer-like operation (posts a compensating `JournalEntry`); it does not mutate the original `TransferOrder`.

## Daily Limits

- Limits are evaluated per `Customer` (across all their accounts) **and** per `BankAccount`, whichever is more restrictive applies.
- Limits are tiered by KYC `TierLevel` and may be further overridden per-account via `AccountLimit` (e.g. a temporary raised limit approved by Support/Compliance).
- `VelocityCheckPolicy` considers not just cumulative daily amount but transaction frequency in a short window — many small transfers in rapid succession can trip a limit even under the cumulative cap.
- Limit values themselves live in Configuration, not in Payments & Transfers code — raising the default daily limit bank-wide is a config change, not a deploy.

## Account Freezes

- A freeze always has a recorded reason category (customer request, suspected fraud, compliance hold, court order, dormancy) — the category determines who can lift it.
- A compliance-hold or court-order freeze cannot be lifted by Support; only Compliance Officer/Administrator roles can (see `security-model.md` for the permission matrix).
- A frozen account blocks customer-initiated debits; whether it blocks credits is category-dependent (a fraud hold typically still allows incoming credits, a court-order freeze typically blocks everything).
- Freezing an account does not cancel already-`TransferInitiated` transfers in flight; those still resolve to `TransferCompleted`/`TransferFailed` on their own merits, but no *new* debit-initiating action is accepted while frozen.

## Loan Eligibility (Loans)

- `IsEligibleForLoanSpec` requires: KYC tier sufficient for the requested loan tier, account in `Active` state, and no unresolved `IsDelinquentSpec` on any existing loan for that customer.
- `IsWithinDebtToIncomeRatioSpec` is evaluated at application time using declared/verified income against total requested + existing obligations — the ratio threshold is a Configuration value, not hardcoded per loan product.
- A `LoanApplication` decision (`LoanApproved`/`LoanRejected`) must record the deciding `Actor` and, on rejection, a reason category.
- Approval of a `LoanApplication` does not itself move money — disbursement is a separate, explicit step (`LoanDisbursed`) that posts through Ledger like any other credit.
- Once disbursed, a `Loan`'s `RepaymentSchedule` is fixed at creation; changing it (restructuring) creates a new schedule version rather than mutating installments that may already be paid.

## Savings Maturity (Savings)

- A `SavingsPlan` with a `MaturityDate` cannot be force-matured early by any actor — maturity is date-driven only.
- `IsEarlyWithdrawalPenalizedSpec` determines whether an early withdrawal incurs a penalty; penalty existence/amount is Configuration-driven per `PlanType`.
- On maturity, `AutoRenewalPolicy` determines default behavior (auto-roll into a new term vs. release to the linked account) — the customer's standing instruction is honored unless explicitly changed before maturity.
- Contributions to a matured, non-renewed `SavingsPlan` are not accepted; the plan is effectively closed pending payout.

## Interest Calculation (high-level only)

- Interest accrual timing and eligibility are a domain concern (`InterestAccrualService` for Savings, high-level rate/term parameters for Loans); the exact day-count convention and compounding formula are explicitly **out of scope for Phase 2A** and deferred to Phase 2B/3 implementation design.
- Whatever formula is chosen later, the rule that **is** fixed now: interest is never applied by mutating a balance directly — it is always realized as a `JournalEntry` posting (`InterestPosted`), same as any other money movement, so it is auditable and reversible like everything else in Ledger.
- Interest rate values are Configuration-scoped per product, versioned with an `EffectiveDate` — a rate change never retroactively alters interest already posted.

## Notification Triggers

- Every event in the catalog (`events.md`) marked as customer- or staff-relevant has a corresponding notification template; a new domain event that should notify someone is not considered "done" until its notification mapping exists.
- Security-sensitive events (login from new device, password changed, large transfer, account frozen) are **non-suppressible** by user notification preferences — a user can opt out of marketing-style notices, never out of security notices.
- `QuietHoursPolicy` defers non-urgent notifications (e.g. marketing, low-priority reminders) to the next allowed window; it never defers security-critical or time-sensitive transactional notices (e.g. OTP).
- `NotificationRateLimitPolicy` prevents a single noisy event source from flooding a customer — duplicate/near-duplicate notifications within a short window are suppressed (`IsDuplicateSuppressedSpec`), not queued for later delivery.
