# Ecoswift Bank — Domain Events Catalog

**Phase 2A deliverable.** Every domain event published across the 14 bounded contexts defined in [`domain-architecture.md`](domain-architecture.md). All events are delivered **at-least-once**; every consumer listed must be idempotent (see "Service Communication" in `domain-architecture.md`).

**Conventions used below:**
- **Payload** lists the meaningful fields, not a schema — field types/DB shape are a Phase 2B concern.
- Every event implicitly also carries: `eventId`, `occurredAt`, `correlationId`, `producerContext` — omitted from each row for brevity, described once here.
- **Audit** is a consumer of *every* event in this catalog via the `AuditableEvent` envelope (see `domain-architecture.md` § Context Map) — also omitted from each row for brevity rather than repeated 50+ times.

---

## Identity & Access

| Event | Trigger | Producer | Consumers (besides Audit) | Payload | Business purpose |
|---|---|---|---|---|---|
| `UserAccountCreated` | New credential set created (typically alongside `CustomerRegistered`) | Identity & Access | Notifications | `userAccountId`, `customerId or staffId`, `createdVia` | Marks the point authentication becomes possible for the linked identity. |
| `EmailVerified` | Customer confirms email verification link/code | Identity & Access | Customer Management, Notifications | `userAccountId`, `email`, `verifiedAt` | Unlocks email-dependent capability (e.g. password reset via email) and feeds `IsProfileCompleteSpec`. |
| `PhoneVerified` | Customer confirms phone OTP | Identity & Access | Customer Management, Notifications | `userAccountId`, `phone`, `verifiedAt` | Same as above for phone; also required before SMS-based 2FA can be enabled. |
| `UserLoggedIn` | Successful authentication | Identity & Access | Audit, Notifications (only if new device — see below) | `userAccountId`, `sessionId`, `deviceId`, `ipAddress`, `riskScore` | Session establishment record; risk score feeds fraud/anomaly review. |
| `UserLoginFailed` | Failed authentication attempt | Identity & Access | Audit | `userAccountId or attemptedIdentifier`, `reason`, `ipAddress` | Feeds `LockoutPolicy` counters and login anomaly detection. |
| `UserLockedOut` | Failed-attempt threshold breached | Identity & Access | Notifications, Support | `userAccountId`, `lockReason`, `unlockEligibleAt` | Customer/Support visibility that self-service login is currently blocked. |
| `PasswordChanged` | Customer/staff changes password (self-service) | Identity & Access | Notifications | `userAccountId`, `changedVia` | Security notice; also invalidates existing sessions per Session Policy. |
| `PasswordResetRequested` | Reset flow initiated | Identity & Access | Notifications | `userAccountId`, `resetChannel` | Delivers the reset link/OTP; also a signal Audit/fraud may want to correlate with subsequent account activity. |
| `PasswordResetCompleted` | Reset flow completed successfully | Identity & Access | Notifications | `userAccountId` | Confirms reset; triggers full session invalidation. |
| `TwoFactorEnabled` | Customer/staff enrolls a 2FA method | Identity & Access | Notifications | `userAccountId`, `method` | Security posture change, notified so an attacker enabling 2FA on a hijacked account is visible to the real owner. |
| `TwoFactorDisabled` | Customer/staff disables 2FA | Identity & Access | Notifications, Audit | `userAccountId`, `method` | Same rationale in reverse — disabling 2FA is high-signal. |
| `SessionRevoked` | Logout, forced logout, or policy-triggered revocation | Identity & Access | — | `sessionId`, `userAccountId`, `revokedBy` | Session lifecycle closure; `revokedBy` distinguishes self vs. admin-forced. |
| `DeviceTrusted` | Device passes step-up verification and is remembered | Identity & Access | Notifications | `userAccountId`, `deviceId` | Reduces future friction; notified so the customer knows a new device was trusted. |
| `SuspiciousLoginDetected` | Risk engine flags a login (new geography, impossible travel, etc.) | Identity & Access | Notifications, Support | `userAccountId`, `signal`, `riskScore` | Triggers step-up challenge and/or proactive customer alert. |

## Customer Management

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `CustomerRegistered` | New `Customer` created | Customer Management | Identity & Access, KYC, Notifications | `customerId`, `fullName`, `primaryContact` | Starting point of the onboarding funnel; triggers `UserAccountCreated` and KYC case creation. |
| `CustomerProfileUpdated` | Profile field(s) changed | Customer Management | KYC (may trigger re-verification), Reporting | `customerId`, `changedFields` | Keeps downstream projections and KYC currency in sync. |
| `CustomerTierChanged` | Tier upgrade/downgrade | Customer Management | Account Management, Payments & Transfers, Loans, Savings | `customerId`, `previousTier`, `newTier` | Propagates new limit/eligibility ceiling to every context that gates on tier. |
| `CustomerDeactivated` | Customer relationship ended | Customer Management | Account Management, Identity & Access, Notifications | `customerId`, `reason` | Cascades account closure eligibility checks and session revocation. |

## KYC

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `KYCSubmitted` | Customer submits a KYC case for review | KYC | Support, Reporting | `kycCaseId`, `customerId`, `tierRequested` | Enters the verification queue. |
| `KYCDocumentUploaded` | A document attached to a case | KYC | — | `kycCaseId`, `documentType` | Internal progress tracking within the case. |
| `KYCApproved` | All required checks pass | KYC | Account Management, Loans, Savings, Notifications | `kycCaseId`, `customerId`, `tierLevel` | Unlocks account opening / product eligibility at the approved tier. |
| `KYCRejected` | A mandatory check fails | KYC | Notifications, Support | `kycCaseId`, `customerId`, `reasonCode` | Blocks progression; routes customer to remediation or Support. |
| `KYCReVerificationRequired` | Periodic or triggered re-check due | KYC | Notifications, Account Management | `kycCaseId`, `customerId`, `dueBy` | May place a soft restriction on the account until re-verification completes. |
| `SanctionsMatchFlagged` | Screening returns a potential match | KYC | Audit, Support (Compliance queue) | `kycCaseId`, `customerId`, `matchConfidence` | Compliance-critical — always routed to human review, never auto-resolved. |

## Account Management

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `AccountOpened` | `BankAccount` created and activated | Account Management | Ledger (initializes balance projection), Notifications, Reporting | `accountId`, `customerId`, `accountType`, `currency` | New account ready for use. |
| `AccountActivated` | `PendingActivation → Active` | Account Management | Notifications | `accountId` | Distinguishes "created" from "usable" for products with an activation gap. |
| `AccountFrozen` | Freeze applied | Account Management | Payments & Transfers, Notifications, Support | `accountId`, `freezeCategory`, `actor` | Downstream contexts must reject new debit-initiating actions immediately. |
| `AccountUnfrozen` | Freeze lifted | Account Management | Payments & Transfers, Notifications | `accountId`, `actor` | Restores normal operation. |
| `AccountClosed` | `→ Closed` transition | Account Management | Ledger, Notifications, Reporting | `accountId`, `closedAt` | Terminal state; Ledger stops accepting new postings for this account. |
| `AccountDormancyFlagged` | Inactivity threshold reached | Account Management | Notifications | `accountId`, `lastActivityAt` | Customer prompt to reactivate before further restriction. |
| `AccountLimitChanged` | An `AccountLimit` override applied | Account Management | Payments & Transfers | `accountId`, `limitType`, `newValue`, `actor` | Payments & Transfers must use the new ceiling on the very next transaction. |

## Ledger

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `JournalEntryPosted` | A balanced `JournalEntry` accepted | Ledger | Reporting, Account Management (balance cache invalidation) | `journalEntryId`, `postings[]`, `reference` | The canonical "money moved" fact; everything else in the system that talks about balances ultimately derives from this. |
| `DepositRecorded` | A journal entry whose net effect is a credit to a customer account | Ledger | Notifications, Reporting | `accountId`, `amount`, `source` | Customer-facing "money in" notice, derived from `JournalEntryPosted` but semantically distinct for notification purposes. |
| `WithdrawalRecorded` | A journal entry whose net effect is a debit to a customer account | Ledger | Notifications, Reporting | `accountId`, `amount`, `destination` | Customer-facing "money out" notice. |
| `BalanceAdjusted` | `AccountBalance` projection updated | Ledger | Account Management | `accountId`, `newBalance` | CQRS read-model update signal — this is the projection catching up to the journal, not a new financial fact. |
| `ReversalPosted` | A compensating entry posted against a prior `JournalEntry` | Ledger | Payments & Transfers, Reporting, Notifications | `originalJournalEntryId`, `reversalJournalEntryId`, `reason` | Confirms a correction happened without ever mutating history. |

## Payments & Transfers

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `TransferInitiated` | `POST /transfers` accepted for processing | Payments & Transfers | Reporting | `transferId`, `sourceAccountId`, `destinationAccountId`, `amount` | Marks the start of the transfer lifecycle before validation completes. |
| `TransferValidated` | All validation specs pass | Payments & Transfers | Ledger (triggers posting request) | `transferId` | Hand-off point to Ledger; separated from `TransferInitiated` so validation failure has its own clean event (`TransferFailed`), not a silently abandoned initiation. |
| `TransferCompleted` | Corresponding `JournalEntryPosted` confirmed | Payments & Transfers | Notifications, Reporting | `transferId`, `completedAt` | The customer-facing "your transfer succeeded" fact. |
| `TransferFailed` | Validation failure or posting failure | Payments & Transfers | Notifications, Reporting | `transferId`, `reasonCode` | Definitive negative outcome — never left implicit. |
| `TransferReversed` | Reversal requested and posted | Payments & Transfers | Notifications, Reporting | `transferId`, `reversalTransferId` | Customer/ops-facing confirmation, backed by `ReversalPosted` in Ledger. |
| `DailyLimitExceeded` | A transfer attempt trips a limit check | Payments & Transfers | Notifications, Audit | `customerId or accountId`, `limitType`, `attemptedAmount` | Customer visibility into why a transfer was blocked; also a fraud-signal input. |

## Loans

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `LoanRequested` | `LoanApplication` submitted | Loans | Reporting | `applicationId`, `customerId`, `amountRequested` | Enters the underwriting queue. |
| `LoanApproved` | Underwriting decision: approve | Loans | Notifications, Reporting | `applicationId`, `loanId`, `approvedAmount`, `terms` | Customer notice; creates the servicing `Loan` aggregate. |
| `LoanRejected` | Underwriting decision: reject | Loans | Notifications | `applicationId`, `reasonCode` | Customer notice with reason category. |
| `LoanDisbursed` | Approved loan's funds released | Loans | Ledger, Notifications, Reporting | `loanId`, `amount`, `disbursementAccountId` | Triggers the actual Ledger posting; loan servicing begins. |
| `RepaymentDue` | Scheduled installment date reached | Loans | Notifications | `loanId`, `installmentId`, `amountDue`, `dueDate` | Customer reminder ahead of/at due date. |
| `RepaymentReceived` | Installment payment posted | Loans | Ledger, Reporting | `loanId`, `installmentId`, `amountPaid` | Updates repayment schedule progress. |
| `LoanDelinquent` | Installment missed past grace period | Loans | Notifications, Support, Reporting | `loanId`, `installmentId`, `daysOverdue` | Triggers collections workflow and credit-risk visibility. |
| `LoanClosed` | Final installment settled (or loan otherwise terminated) | Loans | Notifications, Reporting | `loanId`, `closedReason` | Lifecycle completion. |

## Savings

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `SavingsCreated` | `SavingsPlan` opened | Savings | Notifications, Reporting | `savingsPlanId`, `customerId`, `planType`, `goalAmount` | Confirms plan creation. |
| `SavingsContributionMade` | A contribution posted | Savings | Ledger, Reporting | `savingsPlanId`, `amount` | Triggers the funding-account debit / plan-balance credit posting. |
| `SavingsMatured` | `MaturityDate` reached | Savings | Notifications, Reporting | `savingsPlanId`, `maturedAt` | Triggers `AutoRenewalPolicy` evaluation. |
| `InterestPosted` | Interest accrual realized as a posting | Savings | Ledger, Notifications, Reporting | `savingsPlanId`, `amount`, `period` | Customer-facing interest credit notice; always backed by a `JournalEntryPosted`. |
| `SavingsWithdrawn` | Withdrawal (early or at/after maturity) | Savings | Ledger, Notifications, Reporting | `savingsPlanId`, `amount`, `penaltyApplied` | Confirms payout and whether a penalty applied. |

## Notifications

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `NotificationQueued` | Any upstream event mapped to a template is accepted for delivery | Notifications | — | `notificationId`, `channel`, `recipient`, `templateId` | Internal lifecycle start; useful for delivery-latency reporting. |
| `NotificationSent` | Channel adapter confirms delivery | Notifications (via `services/email-service` / `services/sms-service`) | Reporting | `notificationId`, `channel`, `sentAt` | Confirms the message left the building; not proof of receipt. |
| `NotificationFailed` | Channel adapter reports failure after retries exhausted | Notifications | Support | `notificationId`, `channel`, `reason` | Surfaces delivery failures for security-critical notices (e.g. OTP) to Support/ops. |
| `NotificationSuppressed` | `IsDuplicateSuppressedSpec` or `QuietHoursPolicy` withheld delivery | Notifications | — | `notificationId`, `suppressionReason` | Explains "why didn't the customer get this" without it being a silent no-op. |

## Reporting

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `StatementRequested` | Customer/staff requests a statement | Reporting | — | `reportRequestId`, `accountId`, `period` | Enters the generation queue. |
| `StatementGenerated` | Compilation complete | Reporting | Notifications | `reportRequestId`, `statementId`, `format` | Customer notice that the statement is ready. |
| `RegulatoryReportGenerated` | A scheduled/ad-hoc regulatory report completes | Reporting | Audit, Administration | `reportId`, `reportType`, `period` | Compliance record and staff visibility. |

## Administration

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `StaffProvisioned` | New `StaffMember` created | Administration | Identity & Access, Notifications | `staffId`, `department` | Triggers linked `UserAccount` creation. |
| `RoleAssigned` | A role granted to a `StaffMember` | Administration | Identity & Access, Audit | `staffId`, `role`, `assignedBy` | Authorization source-of-truth change; Identity & Access enforces it on next request. |
| `AdminActionPerformed` | A sensitive action initiated (maker step) | Administration | — | `actionId`, `actionType`, `initiatedBy` | Enters the maker-checker approval queue. |
| `AdminActionApproved` | A sensitive action approved (checker step) | Administration | Audit, and the originating context (e.g. Account Management for a manual limit override) | `actionId`, `approvedBy` | Only after this event does the underlying action actually execute — see `MakerCheckerPolicy`. |

## Support

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `TicketCreated` | New `SupportTicket` opened | Support | Notifications | `ticketId`, `customerId`, `category` | Confirms receipt to the customer. |
| `TicketAssigned` | Ticket routed to a `StaffMember` | Support | Notifications (internal) | `ticketId`, `assigneeId` | Internal ownership tracking. |
| `TicketEscalated` | `IsEscalationRequiredSpec` triggers | Support | Notifications, Administration | `ticketId`, `escalationLevel` | Routes to higher-tier staff. |
| `TicketResolved` | Agent marks resolved | Support | Notifications | `ticketId`, `resolutionSummary` | Customer notice; starts auto-close countdown. |
| `SLABreached` | `SLATrackingService` detects a missed deadline | Support | Administration, Audit | `ticketId`, `slaDeadline` | Operational escalation and compliance record. |

## Configuration

| Event | Trigger | Producer | Consumers | Payload | Business purpose |
|---|---|---|---|---|---|
| `ConfigurationChanged` | A config value's new version approved | Configuration | Every consuming context (Payments & Transfers, Loans, Savings, Identity & Access, Notifications) | `configKey`, `scope`, `newValue`, `effectiveDate` | Lets downstream contexts refresh cached config rather than re-read on every use. |
| `FeatureFlagToggled` | A feature flag flipped | Configuration | Every consuming context | `flagKey`, `enabled`, `scope` | Same rationale, for boolean flags specifically. |

---

## Audit (meta)

Audit does not publish domain events for other contexts to consume — it is a terminal consumer by design (see `domain-architecture.md` § Context Map, Anti-Corruption Layer). Its own internal lifecycle (`AuditRecordCreated`, hash-chain verification results) is out of scope for cross-context integration and therefore not cataloged here.

---

## Phase 2C Addendum — Implementation

Everything above is the Phase 2A business-level catalog (still authoritative for *what happened and why*). This section covers how events actually move, implemented in [`packages/event-bus`](../packages/event-bus) — see [`infrastructure.md`](infrastructure.md) for the surrounding platform context.

### The Envelope

```ts
interface DomainEvent<TType extends string, TPayload> {
  eventId: string;        // UUID, assigned at publish time
  eventType: TType;
  occurredAt: string;      // ISO 8601
  correlationId?: string;  // propagated from CorrelationIdMiddleware, if present
  producerContext: string; // which bounded context published this
  payload: TPayload;
}
```

This is the code realization of the "every event implicitly also carries..." line at the top of this document — no longer implicit, an actual TypeScript type (`packages/event-bus/src/domain-event.base.ts`) every published event is checked against.

### Transport: Redis Streams

`RedisStreamsEventBus` (`packages/event-bus/src/adapters/redis-streams-event-bus.ts`) implements both `EventPublisherPort` and `EventSubscriberPort` — the concrete choice `domain-architecture.md` § Service Communication flagged as the default ("Redis Streams — already in the stack") when it deliberately kept the domain layer broker-agnostic. Each event type gets its own stream (`events:<eventType>`); subscribers join via consumer groups (`XREADGROUP`), so multiple instances of the same service share the workload for a given event type rather than each receiving a full duplicate copy — and a different service's consumer group gets its own independent full copy, exactly as domain-architecture.md's at-least-once/idempotent-consumer guidance assumes.

Failed handlers are retried (delivery count tracked via `XPENDING`) up to a per-subscription `maxAttempts`, then moved to `events:dead-letter:<eventType>` and acknowledged on the original stream — the DLQ pattern `domain-architecture.md` § Retry & Failure Recovery named without committing to a mechanism; this is that mechanism, live.

Swapping to RabbitMQ or Kafka later means writing a new class against the same two ports — no domain code changes, per the whole point of the port/adapter split.

### Implementation Event Type Names

The Phase 2C brief's event list uses slightly different wording than the Phase 2A catalog above for a few events realizing the same business fact. The TypeScript event-type constants (`packages/event-bus/src/events/*.ts`) use the Phase 2C brief's exact names; this table cross-references them to their Phase 2A counterpart above so the two documents don't drift into appearing to describe different systems:

| Phase 2C constant (`packages/event-bus`) | Phase 2A catalog name (this document, above) |
|---|---|
| `CUSTOMER_REGISTERED` (`customer.registered`) | `CustomerRegistered` |
| `EMAIL_VERIFIED` (`identity.email_verified`) | `EmailVerified` |
| `ACCOUNT_OPENED` (`account.opened`) | `AccountOpened` |
| `TRANSFER_STARTED` (`transfer.started`) | `TransferInitiated` |
| `TRANSFER_COMPLETED` (`transfer.completed`) | `TransferCompleted` |
| `TRANSFER_FAILED` (`transfer.failed`) | `TransferFailed` |
| `DEPOSIT_POSTED` (`ledger.deposit_posted`) | `DepositRecorded` |
| `WITHDRAWAL_POSTED` (`ledger.withdrawal_posted`) | `WithdrawalRecorded` |
| `LOAN_APPROVED` (`loan.approved`) | `LoanApproved` |
| `LOAN_REJECTED` (`loan.rejected`) | `LoanRejected` |
| `SAVINGS_CREATED` (`savings.created`) | `SavingsCreated` |
| `INTEREST_POSTED` (`savings.interest_posted`) | `InterestPosted` |
| `RECEIPT_GENERATED` (`reporting.receipt_generated`) | — new in Phase 2C; implied but not separately named in Phase 2A's catalog |
| `STATEMENT_GENERATED` (`reporting.statement_generated`) | `StatementGenerated` |
| `NOTIFICATION_QUEUED` (`notification.queued`) | `NotificationQueued` |
| `NOTIFICATION_SENT` (`notification.sent`) | `NotificationSent` |
| `AUDIT_RECORDED` (`audit.recorded`) | — new in Phase 2C; Phase 2A's Audit section describes ingestion, not a re-publishable "recorded" fact |

The full Phase 2A catalog (this document) remains the source of truth for *every* domain event in the system — the Phase 2C brief's 17 are the subset wired up as concrete, typed, publishable TypeScript events in this phase. The remaining Phase 2A events (`UserLoggedIn`, `KYCApproved`, `TransferFailed`'s siblings, etc.) get the same treatment as their owning context's business logic lands in Phase 3+, following the exact pattern established here rather than a new one.

### Publishing and Subscribing

```ts
// Publishing (from any service with EventBusModule.forRoot() imported)
await eventPublisher.publish({
  eventType: TRANSFER_COMPLETED,
  producerContext: 'transaction-service',
  payload: { transactionId, transactionReference, journalEntryId, completedAt },
});

// Subscribing (typically in a module's onModuleInit)
eventSubscriber.subscribe(TRANSFER_COMPLETED, async (event) => {
  // event.payload is typed as TransferCompletedPayload
}, { consumerGroup: 'notification-service' });
```

`EventBusModule` calls `EventSubscriberPort.start()` automatically on Nest's `onApplicationBootstrap` lifecycle hook — after every module has had the chance to register its `subscribe()` calls during `onModuleInit`, so subscription order relative to `start()` is never a race.
