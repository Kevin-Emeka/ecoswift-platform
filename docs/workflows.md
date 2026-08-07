# Ecoswift Bank — Workflows

**Phase 2A deliverable.** Sequence diagrams for the ten key workflows, using the contexts, aggregates, and events already defined in [`domain-architecture.md`](domain-architecture.md) and [`events.md`](events.md). These describe orchestration, not implementation — no code, no schema.

Diagrams use each context's short name as the participant (e.g. `Payments & Transfers` → `Payments`) for readability; participant order follows the Context Map's dependency direction where possible.

---

## 1. Customer Registration

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant CustMgmt as Customer Mgmt
    participant IAM as Identity & Access
    participant KYC
    participant Notif as Notifications

    Customer->>Gateway: POST /customers (registration data)
    Gateway->>CustMgmt: create Customer
    CustMgmt->>CustMgmt: DeduplicationService check
    alt duplicate found
        CustMgmt-->>Gateway: 409 Conflict
        Gateway-->>Customer: registration rejected
    else unique customer
        CustMgmt->>CustMgmt: CustomerFactory creates Customer
        CustMgmt-->>IAM: event: CustomerRegistered
        IAM->>IAM: UserAccountFactory creates UserAccount + Credential
        IAM-->>Notif: event: UserAccountCreated
        CustMgmt-->>KYC: event: CustomerRegistered
        KYC->>KYC: open KycCase (Not Started)
        Notif->>Customer: send verification email/SMS
        Gateway-->>Customer: 201 Created (unverified)
    end
    Customer->>IAM: confirm verification link/code
    IAM->>IAM: mark Email/PhoneVerified
    IAM-->>CustMgmt: event: EmailVerified / PhoneVerified
    IAM-->>Notif: event: EmailVerified / PhoneVerified
    Notif->>Customer: welcome notification
```

## 2. Login

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant IAM as Identity & Access
    participant Notif as Notifications
    participant Audit

    Customer->>Gateway: POST /auth/login (credentials)
    Gateway->>IAM: authenticate
    IAM->>IAM: verify Credential
    alt invalid credentials
        IAM-->>Audit: event: UserLoginFailed
        IAM-->>Gateway: 401 Unauthorized
        Gateway-->>Customer: login failed
    else valid credentials
        IAM->>IAM: LoginRiskEvaluationService (device, IP, velocity)
        alt device untrusted / risk elevated
            IAM-->>Notif: event: SuspiciousLoginDetected
            IAM-->>Gateway: 401 step-up required
            Gateway-->>Customer: prompt OTP / 2FA challenge
            Customer->>IAM: submit OTP
            IAM->>IAM: verify OtpChallenge
            IAM->>IAM: DeviceTrusted (if verified)
        end
        IAM->>IAM: SessionService issues Session
        IAM-->>Audit: event: UserLoggedIn
        IAM-->>Gateway: 200 OK + session token
        Gateway-->>Customer: authenticated
    end
```

## 3. KYC Approval

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant KYC
    participant Compliance as Compliance Officer
    participant AccMgmt as Account Mgmt
    participant Notif as Notifications

    Customer->>Gateway: POST /kyc/cases/{id}/documents
    Gateway->>KYC: attach KycDocument
    KYC-->>KYC: event: KYCDocumentUploaded
    KYC->>KYC: DocumentVerificationService runs checks
    KYC->>KYC: SanctionsScreeningService runs check
    alt sanctions match
        KYC-->>Compliance: event: SanctionsMatchFlagged
        Compliance->>KYC: manual review decision
    end
    alt any mandatory check fails
        KYC->>KYC: KycCase -> Rejected
        KYC-->>Notif: event: KYCRejected
        Notif->>Customer: rejection + reason
    else all checks pass
        KYC->>KYC: KycCase -> Approved (TierLevel set)
        KYC-->>AccMgmt: event: KYCApproved
        KYC-->>Notif: event: KYCApproved
        Notif->>Customer: KYC approved notice
        Note over AccMgmt: account opening now permitted at approved tier
    end
```

## 4. Account Opening

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant AccMgmt as Account Mgmt
    participant KYC
    participant Ledger
    participant Notif as Notifications

    Customer->>Gateway: POST /accounts (accountType)
    Gateway->>AccMgmt: open account request
    AccMgmt->>KYC: check current TierLevel
    KYC-->>AccMgmt: tier + status
    AccMgmt->>AccMgmt: IsEligibleForOpeningSpec
    alt not eligible
        AccMgmt-->>Gateway: 403 Forbidden
        Gateway-->>Customer: cannot open account (reason)
    else eligible
        AccMgmt->>AccMgmt: BankAccountFactory creates account (PendingActivation)
        AccMgmt->>AccMgmt: assign AccountNumber
        AccMgmt->>AccMgmt: activate -> Active
        AccMgmt-->>Ledger: event: AccountOpened
        Ledger->>Ledger: initialize AccountBalance projection (zero)
        AccMgmt-->>Notif: event: AccountOpened
        Notif->>Customer: account opened notice
        AccMgmt-->>Gateway: 201 Created
        Gateway-->>Customer: account details
    end
```

## 5. Money Transfer

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant Payments as Payments & Transfers
    participant AccMgmt as Account Mgmt
    participant Ledger
    participant Notif as Notifications

    Customer->>Gateway: POST /transfers (idempotencyKey, amount, dest)
    Gateway->>Payments: initiate transfer
    Payments->>Payments: TransferOrderFactory (status: Initiated)
    Payments-->>Payments: event: TransferInitiated
    Payments->>AccMgmt: confirm source/destination Active
    AccMgmt-->>Payments: account status
    Payments->>Payments: HasSufficientFundsSpec, IsWithinDailyLimitSpec, IsDestinationValidSpec
    alt any validation fails
        Payments->>Payments: TransferOrder -> Failed
        Payments-->>Notif: event: TransferFailed
        Payments-->>Gateway: 422 with reasonCode
        Gateway-->>Customer: transfer rejected
    else validated
        Payments-->>Payments: event: TransferValidated
        Payments->>Ledger: POST /ledger/postings (idempotencyKey)
        Ledger->>Ledger: JournalEntryFactory: IsBalancedEntrySpec
        Ledger->>Ledger: append JournalEntry (immutable)
        Ledger-->>Payments: event: JournalEntryPosted
        Payments->>Payments: TransferOrder -> Completed
        Payments-->>Notif: event: TransferCompleted
        Notif->>Customer: debit/credit notifications (both parties)
        Payments-->>Gateway: 200 OK
        Gateway-->>Customer: transfer confirmation
    end
```

## 6. Receipt Generation

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant Payments as Payments & Transfers
    participant Reporting
    participant Notif as Notifications

    Note over Payments: TransferCompleted already emitted
    Payments-->>Reporting: event: TransferCompleted
    Reporting->>Reporting: StatementCompilationService builds receipt record
    Customer->>Gateway: GET /transfers/{id}/receipt
    Gateway->>Reporting: fetch receipt
    alt receipt not yet compiled
        Reporting->>Reporting: compile on demand from TransferCompleted + JournalEntryPosted data
    end
    Reporting-->>Gateway: receipt (PDF/JSON)
    Gateway-->>Customer: receipt
    opt customer requests emailed copy
        Customer->>Gateway: POST /transfers/{id}/receipt/email
        Gateway->>Reporting: request email delivery
        Reporting-->>Notif: event: StatementGenerated (type: receipt)
        Notif->>Customer: receipt emailed
    end
```

## 7. Loan Application

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant Loans
    participant KYC
    participant AccMgmt as Account Mgmt
    participant Ops as Operations
    participant Manager
    participant Ledger
    participant Notif as Notifications

    Customer->>Gateway: POST /loans/applications
    Gateway->>Loans: submit LoanApplication
    Loans->>KYC: check TierLevel
    Loans->>AccMgmt: check account Active
    Loans->>Loans: IsEligibleForLoanSpec, IsWithinDebtToIncomeRatioSpec
    Loans-->>Loans: event: LoanRequested
    alt fails automatic eligibility
        Loans->>Loans: LoanApplication -> Rejected
        Loans-->>Notif: event: LoanRejected
        Notif->>Customer: rejection notice
    else passes automatic checks
        Loans->>Ops: route for decision (LoanApprovalPolicy)
        Ops->>Loans: decision (approve/reject)
        opt amount above threshold
            Loans->>Manager: maker-checker approval required
            Manager->>Loans: checker decision
        end
        alt rejected
            Loans-->>Notif: event: LoanRejected
            Notif->>Customer: rejection notice
        else approved
            Loans->>Loans: LoanFactory creates Loan from application
            Loans-->>Notif: event: LoanApproved
            Notif->>Customer: approval notice
            Loans->>Ledger: request disbursement posting
            Ledger-->>Loans: event: JournalEntryPosted
            Loans-->>Notif: event: LoanDisbursed
            Notif->>Customer: funds disbursed notice
        end
    end
```

## 8. Savings Creation

```mermaid
sequenceDiagram
    actor Customer
    participant Gateway as apps/api
    participant Savings
    participant AccMgmt as Account Mgmt
    participant Ledger
    participant Notif as Notifications

    Customer->>Gateway: POST /savings (planType, goalAmount, fundingAccount)
    Gateway->>Savings: create SavingsPlan
    Savings->>AccMgmt: confirm funding account Active
    AccMgmt-->>Savings: account status
    alt account not eligible
        Savings-->>Gateway: 422 rejected
        Gateway-->>Customer: cannot create plan
    else eligible
        Savings->>Savings: SavingsPlanFactory creates plan
        Savings-->>Notif: event: SavingsCreated
        Notif->>Customer: plan created notice
        opt initial contribution provided
            Savings->>Ledger: request contribution posting
            Ledger-->>Savings: event: JournalEntryPosted
            Savings-->>Notif: event: SavingsContributionMade
        end
        Savings-->>Gateway: 201 Created
        Gateway-->>Customer: plan details
    end
```

## 9. Notification Flow

```mermaid
sequenceDiagram
    participant Producer as Any Context (e.g. Payments)
    participant Notif as Notifications
    participant Template as TemplateRenderingService
    participant Router as ChannelRoutingService
    participant Email as email-service
    participant SMS as sms-service
    actor Customer

    Producer-->>Notif: domain event (e.g. TransferCompleted)
    Notif->>Notif: map event -> NotificationTemplate
    Notif->>Notif: IsDeliverableSpec, IsDuplicateSuppressedSpec
    alt suppressed (duplicate / quiet hours, non-critical)
        Notif-->>Notif: event: NotificationSuppressed
    else deliverable
        Notif->>Notif: NotificationRequestFactory (event: NotificationQueued)
        Notif->>Template: render content for recipient
        Template-->>Notif: rendered message
        Notif->>Router: select channel(s)
        par email channel
            Router->>Email: deliver via EmailGatewayPort
            Email-->>Notif: delivery result
        and sms channel
            Router->>SMS: deliver via SmsGatewayPort
            SMS-->>Notif: delivery result
        end
        alt delivery succeeded
            Notif-->>Notif: event: NotificationSent
            Email-->>Customer: email received
            SMS-->>Customer: SMS received
        else delivery failed after retries
            Notif-->>Notif: event: NotificationFailed
            Notif-->>Notif: route to Support
        end
    end
```

## 10. Audit Logging

```mermaid
sequenceDiagram
    participant AnyContext as Any Bounded Context
    participant Outbox as Outbox (per context)
    participant Bus as Event Bus
    participant Audit
    participant Verifier as IntegrityVerificationService
    actor Compliance as Auditor / Compliance Officer

    AnyContext->>AnyContext: state change committed
    AnyContext->>Outbox: write domain event (same transaction)
    Outbox->>Bus: relay publishes event
    Bus->>Audit: AuditableEvent envelope
    Audit->>Audit: AuditRecordFactory creates AuditRecord
    Audit->>Audit: append to hash-chained, immutable log (event: AuditRecordCreated)
    Note over Audit: WriteOnlyPolicy — no update/delete ever
    loop periodic integrity check
        Audit->>Verifier: verify hash chain
        alt chain intact
            Verifier-->>Audit: OK
        else tampering detected
            Verifier-->>Audit: IsChainIntactSpec fails
            Audit-->>Compliance: integrity alert
        end
    end
    Compliance->>Audit: GET /audit/records (permissioned query)
    Audit-->>Compliance: read-only audit records
```
