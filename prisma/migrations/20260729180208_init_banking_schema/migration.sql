-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DeviceTrustLevel" AS ENUM ('UNTRUSTED', 'TRUSTED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PASSWORD_RESET', 'TRANSACTION_CONFIRMATION', 'TWO_FACTOR_ENROLLMENT');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TwoFactorMethodType" AS ENUM ('TOTP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED');

-- CreateEnum
CREATE TYPE "CurrencyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BeneficiaryStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('INITIATED', 'PENDING', 'VALIDATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "TransferChannel" AS ENUM ('INTERNAL', 'EXTERNAL_ACH', 'EXTERNAL_RTGS', 'EXTERNAL_SWIFT', 'WALLET');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeeCalculationType" AS ENUM ('FLAT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'RE_VERIFICATION_REQUIRED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'UTILITY_BILL', 'BANK_STATEMENT', 'SELFIE', 'PROOF_OF_ADDRESS', 'PROOF_OF_INCOME');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationCheckResult" AS ENUM ('PASS', 'FAIL', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'ACTIVE', 'DELINQUENT', 'DEFAULTED', 'PAID_OFF', 'CLOSED');

-- CreateEnum
CREATE TYPE "InterestCalculationMethod" AS ENUM ('SIMPLE', 'COMPOUND_DAILY', 'COMPOUND_MONTHLY', 'COMPOUND_ANNUALLY');

-- CreateEnum
CREATE TYPE "RepaymentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RepaymentInstallmentStatus" AS ENUM ('SCHEDULED', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "CollateralType" AS ENUM ('REAL_ESTATE', 'VEHICLE', 'FIXED_DEPOSIT', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CollateralStatus" AS ENUM ('PLEDGED', 'RELEASED', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "SavingsStatus" AS ENUM ('ACTIVE', 'MATURED', 'WITHDRAWN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SavingsPlanType" AS ENUM ('FLEXIBLE', 'FIXED_TERM', 'GOAL_BASED', 'RECURRING');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('STATEMENT', 'REGULATORY', 'TAX', 'INTERNAL_AUDIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV', 'XLSX', 'JSON');

-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'FREEZE', 'UNFREEZE', 'EXPORT', 'VIEW');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOCKOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'TWO_FA_ENABLED', 'TWO_FA_DISABLED', 'SUSPICIOUS_LOGIN', 'DEVICE_TRUSTED', 'SESSION_REVOKED');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "FeatureFlagScope" AS ENUM ('GLOBAL', 'CUSTOMER', 'STAFF', 'PRODUCT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_type" "ActorType" NOT NULL DEFAULT 'CUSTOMER',
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ(6),
    "phone" TEXT,
    "phone_verified_at" TIMESTAMPTZ(6),
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" TEXT,
    "nationality_id" UUID,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "device_name" TEXT,
    "platform" TEXT,
    "trust_level" "DeviceTrustLevel" NOT NULL DEFAULT 'UNTRUSTED',
    "trusted_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "access_token_hash" TEXT,
    "refresh_token_hash" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "method" "TwoFactorMethodType" NOT NULL,
    "secret_encrypted" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(6),

    CONSTRAINT "two_factor_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "two_factor_credential_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "customer_number" TEXT NOT NULL,
    "tier" "KycTier" NOT NULL DEFAULT 'TIER_0',
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "country_id" UUID NOT NULL,
    "risk_rating" DECIMAL(5,2),
    "date_joined" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allows_overdraft" BOOLEAN NOT NULL DEFAULT false,
    "minimum_opening_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "account_type_id" UUID NOT NULL,
    "currency_id" UUID NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "iso_code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "status" "CurrencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_base_currency" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "iso_code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "dialing_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "beneficiary_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_name" TEXT,
    "bank_code" TEXT,
    "currency_id" UUID NOT NULL,
    "nickname" TEXT,
    "status" "BeneficiaryStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "normal_balance" "NormalBalance" NOT NULL,
    "description" TEXT,

    CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "customer_account_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "available_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "last_journal_line_id" UUID,
    "last_reconciled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journal_number" TEXT NOT NULL,
    "transaction_id" UUID,
    "description" TEXT NOT NULL,
    "financial_period_id" UUID NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "reversal_of_journal_entry_id" UUID,
    "created_by" UUID,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journal_entry_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "direction" "NormalBalance" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_id" UUID NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "transaction_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_reference" TEXT NOT NULL,
    "transaction_type_id" UUID NOT NULL,
    "source_account_id" UUID,
    "destination_account_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_id" UUID NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "idempotency_key" TEXT,
    "initiated_by" UUID,
    "description" TEXT,
    "metadata" JSONB,
    "failure_reason" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "transfer_channel" "TransferChannel" NOT NULL,
    "source_account_id" UUID NOT NULL,
    "destination_account_id" UUID,
    "destination_beneficiary_id" UUID,
    "requested_amount" DECIMAL(19,4) NOT NULL,
    "narrative" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "account_id" UUID,
    "tier" "KycTier",
    "daily_limit" DECIMAL(19,4) NOT NULL,
    "per_transaction_limit" DECIMAL(19,4) NOT NULL,
    "monthly_limit" DECIMAL(19,4) NOT NULL,
    "currency_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transfer_request_id" UUID NOT NULL,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "maker_id" UUID NOT NULL,
    "checker_id" UUID,
    "maker_action_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checker_action_at" TIMESTAMPTZ(6),
    "comments" TEXT,

    CONSTRAINT "transfer_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transaction_type_id" UUID,
    "calculation_type" "FeeCalculationType" NOT NULL,
    "flat_amount" DECIMAL(19,4),
    "percentage_rate" DECIMAL(6,4),
    "min_fee" DECIMAL(19,4),
    "max_fee" DECIMAL(19,4),
    "currency_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_fees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "fee_schedule_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "base_currency_id" UUID NOT NULL,
    "quote_currency_id" UUID NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject_template" TEXT,
    "body_template" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_user_id" UUID,
    "recipient_customer_id" UUID,
    "template_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB,
    "rendered_subject" TEXT,
    "rendered_body" TEXT,
    "suppressed_reason" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "to_address" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT,
    "body_text" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_attempt_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "provider_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "to_number" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_attempt_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "provider_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "device_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_attempt_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "provider_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "audit_log_id" UUID,
    "is_security_critical" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "tier_requested" "KycTier" NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "risk_score" DECIMAL(5,2),
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kyc_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_application_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_hash" TEXT,
    "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_application_id" UUID NOT NULL,
    "check_type" TEXT NOT NULL,
    "result" "VerificationCheckResult" NOT NULL,
    "confidence" DECIMAL(5,4),
    "provider_reference" TEXT,
    "raw_response" JSONB,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_application_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "min_amount" DECIMAL(19,4) NOT NULL,
    "max_amount" DECIMAL(19,4) NOT NULL,
    "interest_rate" DECIMAL(6,4) NOT NULL,
    "interest_calculation_method" "InterestCalculationMethod" NOT NULL,
    "min_term_months" INTEGER NOT NULL,
    "max_term_months" INTEGER NOT NULL,
    "required_tier" "KycTier" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "loan_product_id" UUID NOT NULL,
    "requested_amount" DECIMAL(19,4) NOT NULL,
    "requested_term_months" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "eligibility_score" DECIMAL(5,2),
    "decision_by" UUID,
    "decision_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loan_application_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "loan_product_id" UUID NOT NULL,
    "disbursement_account_id" UUID NOT NULL,
    "principal_amount" DECIMAL(19,4) NOT NULL,
    "interest_rate" DECIMAL(6,4) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "outstanding_principal" DECIMAL(19,4) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'APPROVED',
    "disbursed_at" TIMESTAMPTZ(6),
    "maturity_date" DATE,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loan_id" UUID NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "installment_amount" DECIMAL(19,4) NOT NULL,
    "frequency" "RepaymentFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repayment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repayment_plan_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_due" DECIMAL(19,4) NOT NULL,
    "interest_due" DECIMAL(19,4) NOT NULL,
    "total_due" DECIMAL(19,4) NOT NULL,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "RepaymentInstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "transaction_id" UUID,
    "paid_at" TIMESTAMPTZ(6),

    CONSTRAINT "repayment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loan_id" UUID NOT NULL,
    "collateral_type" "CollateralType" NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_value" DECIMAL(19,4) NOT NULL,
    "currency_id" UUID NOT NULL,
    "status" "CollateralStatus" NOT NULL DEFAULT 'PLEDGED',
    "pledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan_type" "SavingsPlanType" NOT NULL,
    "interest_rate" DECIMAL(6,4) NOT NULL,
    "interest_calculation_method" "InterestCalculationMethod" NOT NULL,
    "minimum_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "min_term_months" INTEGER,
    "max_term_months" INTEGER,
    "early_withdrawal_penalty_rate" DECIMAL(6,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "savings_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "savings_product_id" UUID NOT NULL,
    "linked_account_id" UUID NOT NULL,
    "goal_amount" DECIMAL(19,4),
    "maturity_date" DATE,
    "status" "SavingsStatus" NOT NULL DEFAULT 'ACTIVE',
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "savings_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "savings_product_id" UUID NOT NULL,
    "tier_min_balance" DECIMAL(19,4),
    "tier_max_balance" DECIMAL(19,4),
    "rate" DECIMAL(6,4) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),

    CONSTRAINT "interest_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_posting_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "savings_account_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "principal_balance" DECIMAL(19,4) NOT NULL,
    "interest_rate" DECIMAL(6,4) NOT NULL,
    "interest_amount" DECIMAL(19,4) NOT NULL,
    "journal_entry_id" UUID,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_posting_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "request_id" UUID,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "file_url" TEXT,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requested_by" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_type" "ReportType" NOT NULL,
    "requested_by" UUID,
    "parameters" JSONB,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "file_url" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_job_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "summary" TEXT,
    "file_url" TEXT,
    "generated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "actor_type" "ActorType",
    "action_type" "AuditActionType" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "description" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" TEXT,
    "correlation_id" TEXT,
    "integrity_hash" TEXT NOT NULL,
    "previous_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "activity" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_type" "SecurityEventType" NOT NULL,
    "device_id" UUID,
    "ip_address" TEXT,
    "risk_score" DECIMAL(5,2),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "device_id" UUID,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "successful" BOOLEAN NOT NULL,
    "failure_reason" TEXT,
    "logged_in_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID,
    "url" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "event_types" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_event_id" UUID NOT NULL,
    "webhook_endpoint_id" UUID NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "last_attempt_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "response_status_code" INTEGER,
    "next_retry_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" "SettingValueType" NOT NULL,
    "description" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" "SettingValueType" NOT NULL,
    "description" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" "FeatureFlagScope" NOT NULL DEFAULT 'GLOBAL',
    "scope_reference" TEXT,
    "rollout_percentage" INTEGER,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "support_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_number" TEXT NOT NULL,
    "customer_id" UUID,
    "category_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to" UUID,
    "sla_deadline" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_id" UUID,
    "author_type" "ActorType" NOT NULL,
    "message" TEXT NOT NULL,
    "is_internal_note" BOOLEAN NOT NULL DEFAULT false,
    "attachment_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_fingerprint_key" ON "devices"("user_id", "device_fingerprint");

-- CreateIndex
CREATE INDEX "sessions_user_id_status_idx" ON "sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_user_id_purpose_status_idx" ON "otp_challenges"("user_id", "purpose", "status");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_credentials_user_id_method_key" ON "two_factor_credentials"("user_id", "method");

-- CreateIndex
CREATE INDEX "backup_codes_two_factor_credential_id_idx" ON "backup_codes"("two_factor_credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_number_key" ON "customers"("customer_number");

-- CreateIndex
CREATE INDEX "customers_tier_idx" ON "customers"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "account_types_code_key" ON "account_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");

-- CreateIndex
CREATE INDEX "accounts_customer_id_idx" ON "accounts"("customer_id");

-- CreateIndex
CREATE INDEX "accounts_status_idx" ON "accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_iso_code_key" ON "currencies"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE INDEX "beneficiaries_customer_id_idx" ON "beneficiaries"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_categories_code_key" ON "account_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_customer_account_id_key" ON "ledger_accounts"("customer_account_id");

-- CreateIndex
CREATE INDEX "ledger_accounts_category_id_idx" ON "ledger_accounts"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_account_id_key" ON "account_balances"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_ledger_account_id_key" ON "account_balances"("ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_journal_number_key" ON "journal_entries"("journal_number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversal_of_journal_entry_id_key" ON "journal_entries"("reversal_of_journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_transaction_id_idx" ON "journal_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "journal_entries_financial_period_id_idx" ON "journal_entries"("financial_period_id");

-- CreateIndex
CREATE INDEX "journal_lines_ledger_account_id_created_at_idx" ON "journal_lines"("ledger_account_id", "created_at");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journal_entry_id_line_number_key" ON "journal_lines"("journal_entry_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_name_key" ON "financial_periods"("name");

-- CreateIndex
CREATE INDEX "financial_periods_start_date_end_date_idx" ON "financial_periods"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_types_code_key" ON "transaction_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_reference_key" ON "transactions"("transaction_reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_source_account_id_idx" ON "transactions"("source_account_id");

-- CreateIndex
CREATE INDEX "transactions_destination_account_id_idx" ON "transactions"("destination_account_id");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_requests_transaction_id_key" ON "transfer_requests"("transaction_id");

-- CreateIndex
CREATE INDEX "transfer_limits_customer_id_idx" ON "transfer_limits"("customer_id");

-- CreateIndex
CREATE INDEX "transfer_limits_account_id_idx" ON "transfer_limits"("account_id");

-- CreateIndex
CREATE INDEX "transfer_approvals_transfer_request_id_idx" ON "transfer_approvals"("transfer_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedules_code_key" ON "fee_schedules"("code");

-- CreateIndex
CREATE INDEX "transaction_fees_transaction_id_idx" ON "transaction_fees"("transaction_id");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_id_quote_currency_id_idx" ON "exchange_rates"("base_currency_id", "quote_currency_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_id_quote_currency_id_effective_key" ON "exchange_rates"("base_currency_id", "quote_currency_id", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_locale_key" ON "notification_templates"("code", "locale");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_status_idx" ON "notifications"("recipient_user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_queue_notification_id_key" ON "email_queue"("notification_id");

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_queue_notification_id_key" ON "sms_queue"("notification_id");

-- CreateIndex
CREATE INDEX "sms_queue_status_idx" ON "sms_queue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "push_queue_notification_id_key" ON "push_queue"("notification_id");

-- CreateIndex
CREATE INDEX "push_queue_status_idx" ON "push_queue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_notifications_notification_id_key" ON "audit_notifications"("notification_id");

-- CreateIndex
CREATE INDEX "kyc_applications_customer_id_idx" ON "kyc_applications"("customer_id");

-- CreateIndex
CREATE INDEX "kyc_applications_status_idx" ON "kyc_applications"("status");

-- CreateIndex
CREATE INDEX "kyc_documents_kyc_application_id_idx" ON "kyc_documents"("kyc_application_id");

-- CreateIndex
CREATE INDEX "verification_results_kyc_application_id_idx" ON "verification_results"("kyc_application_id");

-- CreateIndex
CREATE INDEX "compliance_notes_kyc_application_id_idx" ON "compliance_notes"("kyc_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_code_key" ON "loan_products"("code");

-- CreateIndex
CREATE INDEX "loan_applications_customer_id_idx" ON "loan_applications"("customer_id");

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loan_application_id_key" ON "loans"("loan_application_id");

-- CreateIndex
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "repayment_plans_loan_id_key" ON "repayment_plans"("loan_id");

-- CreateIndex
CREATE INDEX "repayment_schedules_due_date_status_idx" ON "repayment_schedules"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "repayment_schedules_repayment_plan_id_installment_number_key" ON "repayment_schedules"("repayment_plan_id", "installment_number");

-- CreateIndex
CREATE INDEX "collateral_loan_id_idx" ON "collateral"("loan_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_products_code_key" ON "savings_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "savings_accounts_linked_account_id_key" ON "savings_accounts"("linked_account_id");

-- CreateIndex
CREATE INDEX "savings_accounts_customer_id_idx" ON "savings_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "savings_accounts_status_idx" ON "savings_accounts"("status");

-- CreateIndex
CREATE INDEX "interest_rules_savings_product_id_idx" ON "interest_rules"("savings_product_id");

-- CreateIndex
CREATE INDEX "interest_posting_history_savings_account_id_period_idx" ON "interest_posting_history"("savings_account_id", "period");

-- CreateIndex
CREATE INDEX "statements_account_id_period_start_idx" ON "statements"("account_id", "period_start");

-- CreateIndex
CREATE INDEX "statement_requests_account_id_idx" ON "statement_requests"("account_id");

-- CreateIndex
CREATE INDEX "report_jobs_status_idx" ON "report_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_reports_report_job_id_key" ON "audit_reports"("report_job_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "security_events_user_id_event_type_idx" ON "security_events"("user_id", "event_type");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE INDEX "login_history_user_id_logged_in_at_idx" ON "login_history"("user_id", "logged_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "webhook_events_event_type_occurred_at_idx" ON "webhook_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_retry_at_idx" ON "webhook_deliveries"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "application_settings_key_key" ON "application_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "support_categories_name_key" ON "support_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_customer_id_idx" ON "support_tickets"("customer_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_ticket_number_idx" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_nationality_id_fkey" FOREIGN KEY ("nationality_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_credentials" ADD CONSTRAINT "two_factor_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_two_factor_credential_id_fkey" FOREIGN KEY ("two_factor_credential_id") REFERENCES "two_factor_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "account_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_financial_period_id_fkey" FOREIGN KEY ("financial_period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_journal_entry_id_fkey" FOREIGN KEY ("reversal_of_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transaction_type_id_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "transaction_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_destination_beneficiary_id_fkey" FOREIGN KEY ("destination_beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_limits" ADD CONSTRAINT "transfer_limits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_limits" ADD CONSTRAINT "transfer_limits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_limits" ADD CONSTRAINT "transfer_limits_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_approvals" ADD CONSTRAINT "transfer_approvals_transfer_request_id_fkey" FOREIGN KEY ("transfer_request_id") REFERENCES "transfer_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_approvals" ADD CONSTRAINT "transfer_approvals_maker_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_approvals" ADD CONSTRAINT "transfer_approvals_checker_id_fkey" FOREIGN KEY ("checker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_transaction_type_id_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "transaction_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_base_currency_id_fkey" FOREIGN KEY ("base_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_quote_currency_id_fkey" FOREIGN KEY ("quote_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_customer_id_fkey" FOREIGN KEY ("recipient_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_queue" ADD CONSTRAINT "push_queue_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_queue" ADD CONSTRAINT "push_queue_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_notifications" ADD CONSTRAINT "audit_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_notifications" ADD CONSTRAINT "audit_notifications_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "audit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_kyc_application_id_fkey" FOREIGN KEY ("kyc_application_id") REFERENCES "kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_kyc_application_id_fkey" FOREIGN KEY ("kyc_application_id") REFERENCES "kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_notes" ADD CONSTRAINT "compliance_notes_kyc_application_id_fkey" FOREIGN KEY ("kyc_application_id") REFERENCES "kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_notes" ADD CONSTRAINT "compliance_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_disbursement_account_id_fkey" FOREIGN KEY ("disbursement_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_plans" ADD CONSTRAINT "repayment_plans_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_repayment_plan_id_fkey" FOREIGN KEY ("repayment_plan_id") REFERENCES "repayment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral" ADD CONSTRAINT "collateral_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral" ADD CONSTRAINT "collateral_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_savings_product_id_fkey" FOREIGN KEY ("savings_product_id") REFERENCES "savings_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_rules" ADD CONSTRAINT "interest_rules_savings_product_id_fkey" FOREIGN KEY ("savings_product_id") REFERENCES "savings_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_posting_history" ADD CONSTRAINT "interest_posting_history_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "savings_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_posting_history" ADD CONSTRAINT "interest_posting_history_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "statement_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_requests" ADD CONSTRAINT "statement_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_requests" ADD CONSTRAINT "statement_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_report_job_id_fkey" FOREIGN KEY ("report_job_id") REFERENCES "report_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_event_id_fkey" FOREIGN KEY ("webhook_event_id") REFERENCES "webhook_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_fkey" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "support_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Hand-authored additions (Phase 2B): check constraints, immutability guards,
-- and the balanced-journal-entry trigger. Prisma's schema DSL has no native
-- support for multi-row CHECK constraints or triggers, so these are added as
-- raw SQL appended to the Prisma-generated migration above. See
-- docs/ledger-design.md for the full rationale.
-- =============================================================================

-- --- CHECK constraints: positive amounts / rates -----------------------------
-- (ISO code lengths are already enforced by the CHAR(n) column type itself —
-- see docs/database-architecture.md for why a redundant CHECK was skipped.)

ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_rate_positive" CHECK ("rate" > 0);
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_amount_non_negative" CHECK ("amount" >= 0);

ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_amount_range_valid" CHECK ("min_amount" > 0 AND "max_amount" >= "min_amount");
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_term_range_valid" CHECK ("min_term_months" > 0 AND "max_term_months" >= "min_term_months");
ALTER TABLE "loans" ADD CONSTRAINT "loans_principal_positive" CHECK ("principal_amount" > 0);
ALTER TABLE "loans" ADD CONSTRAINT "loans_outstanding_non_negative" CHECK ("outstanding_principal" >= 0);

ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_amounts_non_negative" CHECK ("principal_due" >= 0 AND "interest_due" >= 0 AND "total_due" >= 0 AND "amount_paid" >= 0);

ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_goal_amount_positive" CHECK ("goal_amount" IS NULL OR "goal_amount" > 0);

ALTER TABLE "transfer_limits" ADD CONSTRAINT "transfer_limits_amounts_positive" CHECK ("daily_limit" > 0 AND "per_transaction_limit" > 0 AND "monthly_limit" > 0);
ALTER TABLE "transfer_limits" ADD CONSTRAINT "transfer_limits_ordering_valid" CHECK ("per_transaction_limit" <= "daily_limit" AND "daily_limit" <= "monthly_limit");

ALTER TABLE "account_types" ADD CONSTRAINT "account_types_min_opening_balance_non_negative" CHECK ("minimum_opening_balance" >= 0);

ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_date_range_valid" CHECK ("end_date" >= "start_date");
ALTER TABLE "statements" ADD CONSTRAINT "statements_period_valid" CHECK ("period_end" >= "period_start");
ALTER TABLE "statement_requests" ADD CONSTRAINT "statement_requests_period_valid" CHECK ("period_end" >= "period_start");

-- --- Ledger immutability: journal_entries / journal_lines are append-only ---
-- Correcting a mistake means posting a new, compensating reversal entry —
-- never editing or deleting history (business-rules.md § Balance Rules,
-- PostingPolicy). This is enforced here, not just in application code, so a
-- direct-SQL or buggy-migration mutation can't silently corrupt the ledger.

CREATE OR REPLACE FUNCTION fn_prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not permitted: this table is append-only', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_entries_immutable
  BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_mutation();

CREATE TRIGGER trg_journal_lines_immutable
  BEFORE UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_mutation();

-- audit_logs is the same "append-only, tamper-evident" contract
-- (security-model.md § Audit Strategy, WriteOnlyPolicy / ImmutabilityPolicy).
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_mutation();

-- --- CRITICAL REQUIREMENT: no journal entry may ever be unbalanced ----------
-- A JournalEntry's lines are inserted as a set (one INSERT per line) within a
-- single database transaction. Checking balance after each individual row
-- would reject every entry with more than one line before the rest have been
-- inserted — so this MUST be a DEFERRED constraint trigger, checked once at
-- COMMIT (or on explicit `SET CONSTRAINTS ALL IMMEDIATE`), by which point every
-- line in the entry has been written. This is the database-level backstop for
-- `IsBalancedEntrySpec` (business-rules.md) — the application's
-- `JournalEntryFactory` is expected to enforce the same rule *before* ever
-- issuing the inserts, so this trigger should only ever fire on a bug or a
-- direct-SQL write that bypassed the application layer.

CREATE OR REPLACE FUNCTION fn_enforce_balanced_journal_entry() RETURNS trigger AS $$
DECLARE
  affected_entry_id uuid;
  unbalanced_count integer;
BEGIN
  affected_entry_id := COALESCE(NEW."journal_entry_id", OLD."journal_entry_id");

  SELECT count(*) INTO unbalanced_count
  FROM (
    SELECT "currency_id",
           SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount" ELSE 0 END) AS total_debit,
           SUM(CASE WHEN "direction" = 'CREDIT' THEN "amount" ELSE 0 END) AS total_credit
    FROM "journal_lines"
    WHERE "journal_entry_id" = affected_entry_id
    GROUP BY "currency_id"
  ) balances_by_currency
  WHERE total_debit <> total_credit;

  IF unbalanced_count > 0 THEN
    RAISE EXCEPTION 'Unbalanced journal entry % : total debits must equal total credits within each currency', affected_entry_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_enforce_balanced_journal_entry
  AFTER INSERT ON "journal_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_balanced_journal_entry();
