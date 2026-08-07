/**
 * Ecoswift Bank — production-style reference/config seed data.
 *
 * This seeds catalog and configuration data that must exist before the
 * platform can be used at all (roles, currencies, chart of accounts,
 * transaction types, notification templates) plus a single break-glass
 * Administrator account. It deliberately does NOT seed fake customers,
 * accounts, or transactions — Phase 2B is data architecture, not business
 * data, and fabricated transactional data has no place in a bank's seed.
 *
 * Run with: pnpm db:seed
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../packages/database/generated/client';
import { PERMISSION_CATALOG, ROLE_CATALOG } from '../packages/authz/src/catalog/permission-catalog';
import { ISO_COUNTRIES } from './data/iso-countries';

const prisma = new PrismaClient();

function readEmailTemplate(fileName: string): string {
  return readFileSync(path.join(__dirname, 'templates', 'emails', fileName), 'utf8');
}

async function seedCurrencies() {
  const currencies = [
    { isoCode: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, isBaseCurrency: true },
    { isoCode: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isBaseCurrency: false },
    { isoCode: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2, isBaseCurrency: false },
    { isoCode: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimalPlaces: 2, isBaseCurrency: false },
    { isoCode: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimalPlaces: 2, isBaseCurrency: false },
    { isoCode: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimalPlaces: 2, isBaseCurrency: false },
    { isoCode: 'ZAR', name: 'South African Rand', symbol: 'R', decimalPlaces: 2, isBaseCurrency: false },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { isoCode: currency.isoCode },
      update: {},
      create: { ...currency, status: 'ACTIVE' },
    });
  }
  console.log(`Seeded ${currencies.length} currencies`);
}

async function seedCountries() {
  for (const country of ISO_COUNTRIES) {
    await prisma.country.upsert({
      where: { isoCode: country.isoCode },
      update: { ...country },
      create: { ...country, isActive: true },
    });
  }
  console.log(`Seeded ${ISO_COUNTRIES.length} countries`);
}

// Phase 2B seeded a 7-role placeholder catalog (SUPPORT_AGENT, OPERATIONS,
// ADMINISTRATOR, MANAGER + 3 unchanged) with a representative, non-exhaustive
// permission set. Phase 3B (docs/rbac.md) is the first phase that actually
// implements role/permission management, and re-seeds against the real
// 10-role catalog the brief specifies — these are the placeholder names it
// replaces. Deleting them (rather than leaving them alongside the new
// catalog) cascades away their RolePermission/UserRole rows; safe in every
// environment this seed has ever run against, since Phase 3A only ever
// assigned SUPER_ADMINISTRATOR (a name that carries over unchanged) to the
// single seeded break-glass account.
const LEGACY_ROLE_NAMES = ['SUPPORT_AGENT', 'OPERATIONS', 'ADMINISTRATOR', 'MANAGER'];

async function seedRolesAndPermissions() {
  await prisma.role.deleteMany({ where: { name: { in: LEGACY_ROLE_NAMES } } });

  // Phase 2B's placeholder catalog used different resource:action pairs
  // than PERMISSION_CATALOG for some of the same ideas (e.g. `audit:read`
  // vs. this catalog's `audit_logs:read`, `ledger:read`/`staff:manage`/
  // `config:manage`/`system:override` have no equivalent here at all).
  // Deleting whichever Permission rows aren't in the current catalog
  // cascades away any RolePermission grant still pointing at them —
  // without this, a role whose *name* didn't change (COMPLIANCE_OFFICER,
  // AUDITOR, SUPER_ADMINISTRATOR) would silently keep stale grants
  // alongside its fresh ones instead of matching the catalog exactly.
  const currentKeys = new Set(PERMISSION_CATALOG.map((p) => `${p.resource}:${p.action}`));
  const existingPermissions = await prisma.permission.findMany({ select: { id: true, resource: true, action: true } });
  const stalePermissionIds = existingPermissions
    .filter((p) => !currentKeys.has(`${p.resource}:${p.action}`))
    .map((p) => p.id);
  if (stalePermissionIds.length > 0) {
    await prisma.permission.deleteMany({ where: { id: { in: stalePermissionIds } } });
  }

  const permissionRecords = new Map<string, string>();
  for (const permission of PERMISSION_CATALOG) {
    const record = await prisma.permission.upsert({
      where: { resource_action: { resource: permission.resource, action: permission.action } },
      update: { description: permission.description },
      create: permission,
    });
    permissionRecords.set(`${permission.resource}:${permission.action}`, record.id);
  }
  console.log(`Seeded ${PERMISSION_CATALOG.length} permissions (removed ${stalePermissionIds.length} superseded)`);

  // Pass 1: create/update every role's own fields. Hierarchy (parentRoleId)
  // is deliberately not set here — a role's parent must already exist as a
  // row before its id can be referenced, and ROLE_CATALOG's declaration
  // order isn't guaranteed to list parents before children.
  const roleRecords = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystemRole: role.isSystemRole, isSensitive: role.isSensitive },
      create: {
        name: role.name,
        description: role.description,
        isSystemRole: role.isSystemRole,
        isSensitive: role.isSensitive,
      },
    });
    roleRecords.set(role.name, record.id);
  }

  // Pass 2: now that every role exists, wire up parent links.
  for (const role of ROLE_CATALOG) {
    if (!role.parentRoleName) continue;
    await prisma.role.update({
      where: { id: roleRecords.get(role.name)! },
      data: { parentRoleId: roleRecords.get(role.parentRoleName)! },
    });
  }
  console.log(`Seeded ${ROLE_CATALOG.length} roles`);

  for (const role of ROLE_CATALOG) {
    const roleId = roleRecords.get(role.name)!;
    for (const permissionKey of role.permissions) {
      const permissionId = permissionRecords.get(permissionKey);
      if (!permissionId) {
        throw new Error(`Role "${role.name}" grants unknown permission "${permissionKey}" — check PERMISSION_CATALOG`);
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
  console.log('Seeded role-permission grants');

  return roleRecords;
}

async function seedAdministrator(roleRecords: Map<string, string>) {
  const country = await prisma.country.findUniqueOrThrow({ where: { isoCode: 'US' } });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecoswiftbank.com' },
    update: {},
    create: {
      actorType: 'STAFF',
      email: 'admin@ecoswiftbank.com',
      emailVerifiedAt: new Date(),
      // Placeholder only — bcrypt-shaped so the field/column sizing is
      // realistic, but NOT a usable credential. This account must go
      // through a forced password-reset flow before first use in any real
      // environment; it is never login-capable as seeded.
      passwordHash: '$2b$12$PLACEHOLDER.ROTATE.BEFORE.FIRST.USE.................',
      status: 'ACTIVE',
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Administrator',
          dateOfBirth: new Date('1990-01-01'),
          nationalityId: country.id,
        },
      },
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleRecords.get('SUPER_ADMINISTRATOR')! } },
    update: {},
    create: { userId: admin.id, roleId: roleRecords.get('SUPER_ADMINISTRATOR')! },
  });

  console.log('Seeded break-glass Administrator account (admin@ecoswiftbank.com — password reset required before use)');
}

async function seedApplicationSettings() {
  const settings = [
    { key: 'kyc.tier1.daily_transfer_limit', value: '1000.00', valueType: 'NUMBER' as const, description: 'Daily transfer limit (USD) for Tier 1 KYC customers' },
    { key: 'kyc.tier2.daily_transfer_limit', value: '10000.00', valueType: 'NUMBER' as const, description: 'Daily transfer limit (USD) for Tier 2 KYC customers' },
    { key: 'kyc.tier3.daily_transfer_limit', value: '100000.00', valueType: 'NUMBER' as const, description: 'Daily transfer limit (USD) for Tier 3 KYC customers' },
    { key: 'password.min_length', value: '12', valueType: 'NUMBER' as const, description: 'Minimum password length' },
    { key: 'password.history_count', value: '5', valueType: 'NUMBER' as const, description: 'Number of previous passwords disallowed on reuse' },
    { key: 'session.idle_timeout_minutes', value: '15', valueType: 'NUMBER' as const, description: 'Sliding session inactivity timeout' },
    { key: 'session.absolute_timeout_hours', value: '12', valueType: 'NUMBER' as const, description: 'Absolute maximum session lifetime' },
    { key: 'otp.expiry_minutes', value: '5', valueType: 'NUMBER' as const, description: 'OTP challenge validity window' },
    { key: 'otp.max_attempts', value: '5', valueType: 'NUMBER' as const, description: 'Max verification attempts per OTP challenge' },
    { key: 'loan.max_debt_to_income_ratio', value: '0.4', valueType: 'NUMBER' as const, description: 'Maximum allowed debt-to-income ratio for loan eligibility' },
    { key: 'transfer.maker_checker_threshold', value: '5000.00', valueType: 'NUMBER' as const, description: 'Transfer amount (USD) above which maker-checker approval is required' },

    // Phase 3A: Identity & Authentication policy
    { key: 'session.max_concurrent', value: '5', valueType: 'NUMBER' as const, description: 'Max concurrent active sessions per user before the oldest is revoked' },
    { key: 'account.max_failed_login_attempts', value: '5', valueType: 'NUMBER' as const, description: 'Failed login attempts before LockoutPolicy locks the account' },
    { key: 'account.lockout_duration_minutes', value: '15', valueType: 'NUMBER' as const, description: 'How long an account stays locked after exceeding max failed attempts' },
    { key: 'password.require_uppercase', value: 'true', valueType: 'BOOLEAN' as const, description: 'Require at least one uppercase letter in passwords' },
    { key: 'password.require_lowercase', value: 'true', valueType: 'BOOLEAN' as const, description: 'Require at least one lowercase letter in passwords' },
    { key: 'password.require_number', value: 'true', valueType: 'BOOLEAN' as const, description: 'Require at least one digit in passwords' },
    { key: 'password.require_symbol', value: 'true', valueType: 'BOOLEAN' as const, description: 'Require at least one special character in passwords' },
    { key: 'email_verification.expiry_minutes', value: '60', valueType: 'NUMBER' as const, description: 'Email verification link validity window' },
    { key: 'password_reset.expiry_minutes', value: '30', valueType: 'NUMBER' as const, description: 'Password reset link validity window' },
    { key: 'access_token.ttl_minutes', value: '15', valueType: 'NUMBER' as const, description: 'JWT access token lifetime' },
    { key: 'refresh_token.ttl_days', value: '7', valueType: 'NUMBER' as const, description: 'Refresh token / session lifetime (standard login)' },
    { key: 'refresh_token.remember_me_ttl_days', value: '30', valueType: 'NUMBER' as const, description: 'Refresh token / session lifetime when "remember me" is selected' },
    { key: 'mfa.challenge_ttl_minutes', value: '5', valueType: 'NUMBER' as const, description: 'How long an MFA challenge token issued mid-login stays valid' },
    { key: 'mfa.step_up_ttl_minutes', value: '10', valueType: 'NUMBER' as const, description: 'How long a step-up assertion stays valid after fresh MFA re-verification' },
    { key: 'mfa.backup_code_count', value: '10', valueType: 'NUMBER' as const, description: 'Number of single-use backup codes issued per MFA enrollment/regeneration' },
    { key: 'session.suspicious_ip_change_window_minutes', value: '5', valueType: 'NUMBER' as const, description: 'A new session from a different IP than another still-active session for the same user, within this window, is flagged suspicious' },
  ];

  for (const setting of settings) {
    await prisma.applicationSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`Seeded ${settings.length} application settings`);
}

async function seedSystemSettings() {
  const settings = [
    { key: 'system.maintenance_mode', value: 'false', valueType: 'BOOLEAN' as const, description: 'Global maintenance mode toggle' },
    { key: 'system.default_rate_limit_per_minute', value: '100', valueType: 'NUMBER' as const, description: 'Default API rate limit per client per minute' },
    { key: 'system.webhook_max_retry_attempts', value: '8', valueType: 'NUMBER' as const, description: 'Max delivery attempts for outbound webhooks' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`Seeded ${settings.length} system settings`);
}

async function seedFeatureFlags() {
  const flags = [
    { key: 'loans.enabled', name: 'Loan products', isEnabled: true, scope: 'GLOBAL' as const },
    { key: 'savings.auto_renewal_enabled', name: 'Savings auto-renewal', isEnabled: true, scope: 'GLOBAL' as const },
    { key: 'notifications.push_enabled', name: 'Push notification channel', isEnabled: false, scope: 'GLOBAL' as const },
    { key: 'transfers.new_validation_flow', name: 'New transfer validation flow', isEnabled: false, scope: 'GLOBAL' as const, rolloutPercentage: 0 },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }
  console.log(`Seeded ${flags.length} feature flags`);
}

async function seedChartOfAccounts() {
  const categories = [
    { code: 'ASSET', name: 'Assets', type: 'ASSET' as const, normalBalance: 'DEBIT' as const },
    { code: 'LIABILITY', name: 'Liabilities', type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const },
    { code: 'EQUITY', name: 'Equity', type: 'EQUITY' as const, normalBalance: 'CREDIT' as const },
    { code: 'REVENUE', name: 'Revenue', type: 'REVENUE' as const, normalBalance: 'CREDIT' as const },
    { code: 'EXPENSE', name: 'Expenses', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const },
  ];

  const categoryRecords = new Map<string, string>();
  for (const category of categories) {
    const record = await prisma.accountCategory.upsert({
      where: { code: category.code },
      update: {},
      create: category,
    });
    categoryRecords.set(category.code, record.id);
  }
  console.log(`Seeded ${categories.length} account categories`);

  // Internal (non-customer-linked) chart-of-accounts entries — the bank's
  // own ledger accounts. Per-customer ledger accounts are created when each
  // Account is opened (Phase 3), not seeded here.
  const ledgerAccounts = [
    { code: '1000', name: 'Cash and Bank Balances', category: 'ASSET' },
    { code: '1100', name: 'Loans Receivable', category: 'ASSET' },
    { code: '2000', name: 'Customer Deposits Payable', category: 'LIABILITY' },
    { code: '3000', name: 'Retained Earnings', category: 'EQUITY' },
    { code: '4000', name: 'Interest Income', category: 'REVENUE' },
    { code: '4100', name: 'Fee Income', category: 'REVENUE' },
    { code: '5000', name: 'Interest Expense', category: 'EXPENSE' },
  ];

  for (const account of ledgerAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { code: account.code },
      update: {},
      create: {
        code: account.code,
        name: account.name,
        categoryId: categoryRecords.get(account.category)!,
      },
    });
  }
  console.log(`Seeded ${ledgerAccounts.length} chart-of-accounts entries`);
}

async function seedTransactionTypes() {
  const types = [
    { code: 'DEPOSIT', name: 'Deposit', description: 'Funds credited into an account' },
    { code: 'WITHDRAWAL', name: 'Withdrawal', description: 'Funds debited from an account' },
    { code: 'ADMIN_CREDIT', name: 'Admin Credit', description: 'Funds credited into an account by staff (e.g. opening-balance funding after the fact)' },
    { code: 'TRANSFER_INTERNAL', name: 'Internal Transfer', description: 'Transfer between two Ecoswift Bank accounts' },
    { code: 'TRANSFER_EXTERNAL', name: 'External Transfer', description: 'Transfer to an account at another institution' },
    { code: 'LOAN_DISBURSEMENT', name: 'Loan Disbursement', description: 'Loan principal released to a customer account' },
    { code: 'LOAN_REPAYMENT', name: 'Loan Repayment', description: 'Customer repayment applied to an outstanding loan' },
    { code: 'SAVINGS_CONTRIBUTION', name: 'Savings Contribution', description: 'Funds moved into a savings plan' },
    { code: 'INTEREST_POSTING', name: 'Interest Posting', description: 'Accrued interest realized as a ledger posting' },
    { code: 'FEE_CHARGE', name: 'Fee Charge', description: 'A fee applied to a customer account' },
    { code: 'REVERSAL', name: 'Reversal', description: 'A compensating reversal of a prior transaction' },
  ];

  for (const type of types) {
    await prisma.transactionType.upsert({
      where: { code: type.code },
      update: { ...type },
      create: { ...type, isActive: true },
    });
  }
  console.log(`Seeded ${types.length} transaction types`);
}

async function seedAccountTypes() {
  const types = [
    { code: 'CURRENT', name: 'Current Account', allowsOverdraft: false, minimumOpeningBalance: 0 },
    { code: 'SAVINGS', name: 'Savings Account', allowsOverdraft: false, minimumOpeningBalance: 0 },
    { code: 'FIXED_DEPOSIT', name: 'Fixed Deposit Account', allowsOverdraft: false, minimumOpeningBalance: 100 },
    // Phase 4A: future-ready product, opened through the same generic
    // account-opening flow as CURRENT/SAVINGS — business-specific KYC
    // (company registration docs, authorized-signatory review) is out of
    // scope for this phase; see docs/account-opening.md.
    { code: 'BUSINESS', name: 'Business Account', allowsOverdraft: false, minimumOpeningBalance: 0 },
  ];

  for (const type of types) {
    await prisma.accountType.upsert({
      where: { code: type.code },
      update: {},
      create: { ...type, isActive: true },
    });
  }
  console.log(`Seeded ${types.length} account types`);
}

/**
 * A single platform-wide default (`customerId`/`accountId`/`tier` all
 * null — see `TransferLimit`'s comment and `TransferLimitsService`'s
 * resolution order). Aligned with the `kyc.tier1.daily_transfer_limit`
 * `ApplicationSetting` (1000.00) seeded above so the two don't disagree
 * until a later phase properly unifies "configurable limits" onto one
 * mechanism. Admins raise/lower limits by inserting a more specific
 * (customer-, account-, or tier-scoped) `TransferLimit` row — this
 * function only ever seeds the fallback.
 */
async function seedTransferLimits() {
  const usd = await prisma.currency.findUniqueOrThrow({ where: { isoCode: 'USD' } });

  const existing = await prisma.transferLimit.findFirst({
    where: { customerId: null, accountId: null, tier: null, currencyId: usd.id },
  });
  if (existing) {
    console.log('Default transfer limit already present, skipping');
    return;
  }

  await prisma.transferLimit.create({
    data: {
      currencyId: usd.id,
      dailyLimit: 1000,
      perTransactionLimit: 500,
      monthlyLimit: 10000,
    },
  });
  console.log('Seeded default transfer limit (USD)');
}

async function seedNotificationTemplates() {
  const templates = [
    // Phase 3A: professional HTML templates for the 4 auth-flow emails
    // named in the brief. Bodies are read from prisma/templates/emails/ —
    // real files, not inline strings — so they're reviewable/diffable like
    // any other source, per docs/authentication.md § Email Templates.
    { code: 'WELCOME', channel: 'EMAIL' as const, subjectTemplate: 'Welcome to Ecoswift Bank', bodyTemplate: readEmailTemplate('welcome.html') },
    { code: 'EMAIL_VERIFICATION', channel: 'EMAIL' as const, subjectTemplate: 'Verify your email address', bodyTemplate: readEmailTemplate('email-verification.html') },
    { code: 'PASSWORD_RESET_REQUEST', channel: 'EMAIL' as const, subjectTemplate: 'Reset your password', bodyTemplate: readEmailTemplate('password-reset.html') },
    { code: 'LOGIN_NEW_DEVICE', channel: 'EMAIL' as const, subjectTemplate: 'New sign-in to your account', bodyTemplate: readEmailTemplate('login-alert.html') },

    { code: 'OTP_CHALLENGE', channel: 'SMS' as const, bodyTemplate: 'Your Ecoswift Bank verification code is {{code}}. It expires in {{expiryMinutes}} minutes. Never share this code.' },
    { code: 'LOGIN_ALERT_SMS', channel: 'SMS' as const, bodyTemplate: 'Ecoswift Bank: new sign-in to your account from {{location}} at {{loginTime}}. Not you? Contact security@ecoswiftbank.com.' },
    { code: 'TRANSFER_COMPLETED', channel: 'PUSH' as const, subjectTemplate: 'Transfer completed', bodyTemplate: 'Your transfer of {{amount}} {{currency}} to {{recipient}} was completed.' },
    { code: 'TRANSFER_COMPLETED_EMAIL', channel: 'EMAIL' as const, subjectTemplate: 'Transfer completed — {{amount}} {{currencyCode}}', bodyTemplate: readEmailTemplate('transfer-completed.html') },
    // Phase 6 (Milestone 2): the remaining transfer lifecycle emails —
    // initiated fires from the held-for-review branch (not on every
    // synchronous transfer, which would duplicate the completed email),
    // failed/cancelled are scheduled-transfer-only (a same-day transfer
    // either completes or throws straight back to the caller), and the
    // large-transfer alert reuses the same maker-checker threshold that
    // already gates MFA step-up — see transfer-thresholds.ts.
    { code: 'TRANSFER_INITIATED_EMAIL', channel: 'EMAIL' as const, subjectTemplate: 'Transfer received — pending review', bodyTemplate: readEmailTemplate('transfer-initiated.html') },
    { code: 'TRANSFER_FAILED_EMAIL', channel: 'EMAIL' as const, subjectTemplate: 'Transfer failed — {{amount}} {{currencyCode}}', bodyTemplate: readEmailTemplate('transfer-failed.html') },
    { code: 'TRANSFER_CANCELLED_EMAIL', channel: 'EMAIL' as const, subjectTemplate: 'Scheduled transfer cancelled', bodyTemplate: readEmailTemplate('transfer-cancelled.html') },
    { code: 'LARGE_TRANSFER_ALERT_EMAIL', channel: 'EMAIL' as const, subjectTemplate: 'Security alert: large transfer — {{amount}} {{currencyCode}}', bodyTemplate: readEmailTemplate('large-transfer-alert.html') },
    { code: 'ACCOUNT_FROZEN', channel: 'EMAIL' as const, subjectTemplate: 'Your account has been frozen', bodyTemplate: 'Account {{accountNumber}} was frozen. Reason: {{reasonCategory}}. Contact support if you believe this is an error.' },
    { code: 'KYC_APPROVED', channel: 'EMAIL' as const, subjectTemplate: 'Identity verification approved', bodyTemplate: 'Your KYC verification has been approved at tier {{tier}}.' },
    { code: 'KYC_REJECTED', channel: 'EMAIL' as const, subjectTemplate: 'Identity verification could not be completed', bodyTemplate: 'Your KYC submission was rejected: {{reason}}. Please resubmit.' },
    { code: 'PASSWORD_CHANGED', channel: 'EMAIL' as const, subjectTemplate: 'Your password was changed', bodyTemplate: 'Your password was changed at {{timestamp}}. If this wasn\'t you, contact security@ecoswiftbank.com immediately.' },

    // Phase 3C: MFA / enterprise security.
    { code: 'OTP_CHALLENGE_EMAIL', channel: 'EMAIL' as const, subjectTemplate: 'Your verification code', bodyTemplate: 'Your Ecoswift Bank verification code is {{code}}. It expires in {{expiryMinutes}} minutes. Never share this code with anyone, including Ecoswift Bank staff.' },
    { code: 'SECURITY_ALERT', channel: 'EMAIL' as const, subjectTemplate: '{{subject}}', bodyTemplate: '{{message}} This happened at {{timestamp}}. If this wasn\'t you, contact security@ecoswiftbank.com immediately.' },

    // Phase 4A: account opening.
    { code: 'ACCOUNT_OPENED', channel: 'EMAIL' as const, subjectTemplate: 'Your {{accountTypeName}} is open', bodyTemplate: readEmailTemplate('account-opened.html') },
    { code: 'ACCOUNT_OPENED_SMS', channel: 'SMS' as const, bodyTemplate: 'Ecoswift Bank: your {{accountTypeName}} {{accountNumber}} is now open. Welcome aboard!' },
    { code: 'ACCOUNT_OPENED_PUSH', channel: 'PUSH' as const, subjectTemplate: 'Account opened', bodyTemplate: 'Your {{accountTypeName}} {{accountNumber}} is ready to use.' },
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { code_locale: { code: template.code, locale: 'en' } },
      update: { ...template },
      create: { ...template, locale: 'en', isActive: true },
    });
  }
  console.log(`Seeded ${templates.length} notification templates`);
}

async function main() {
  console.log('Seeding Ecoswift Bank reference data...\n');

  await seedCurrencies();
  await seedCountries();
  const roleRecords = await seedRolesAndPermissions();
  await seedAdministrator(roleRecords);
  await seedApplicationSettings();
  await seedSystemSettings();
  await seedFeatureFlags();
  await seedChartOfAccounts();
  await seedTransactionTypes();
  await seedAccountTypes();
  await seedTransferLimits();
  await seedNotificationTemplates();

  console.log('\nSeed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
