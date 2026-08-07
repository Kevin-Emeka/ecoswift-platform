/**
 * The canonical permission catalog (docs/permission-matrix.md is generated
 * from this file, not maintained by hand — see that doc's header). Kept
 * dependency-free (no NestJS, no Prisma) so it can be imported from
 * anywhere that needs the list of what's grantable, including
 * `prisma/seed.ts` at seed time and any future service that wants to
 * reference a permission code without depending on this whole package.
 */

export const PERMISSION_RESOURCES = [
  'accounts',
  'customers',
  'transactions',
  'transfer_limits',
  'beneficiaries',
  'loans',
  'savings',
  'statements',
  'notifications',
  'support_tickets',
  'audit_logs',
  'kyc',
  'reports',
  'users',
  'roles',
  'system_config',
  'api_keys',
  'feature_flags',
  'webhooks',
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export interface PermissionDefinition {
  resource: PermissionResource;
  action: string;
  description: string;
}

export function permissionCode(resource: string, action: string): string {
  return `${resource}:${action}`;
}

/** Every grantable `resource:action` pair. Actions are per-resource, not a forced uniform CRUD set — a resource only gets the actions that are actually meaningful for it. */
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Accounts
  { resource: 'accounts', action: 'read', description: 'View account details and balances' },
  { resource: 'accounts', action: 'list', description: 'Browse/search accounts across all customers (staff)' },
  { resource: 'accounts', action: 'create', description: 'Open a new account' },
  { resource: 'accounts', action: 'update', description: 'Update account details' },
  { resource: 'accounts', action: 'freeze', description: 'Freeze an account' },
  { resource: 'accounts', action: 'unfreeze', description: 'Unfreeze a previously frozen account' },
  { resource: 'accounts', action: 'close', description: 'Close an account' },
  { resource: 'accounts', action: 'credit', description: "Credit funds directly into any customer's account (staff-assisted funding, sandbox-only)" },

  // Customers
  { resource: 'customers', action: 'read', description: 'View customer profile' },
  { resource: 'customers', action: 'list', description: 'Browse/search customers across the bank (staff)' },
  { resource: 'customers', action: 'create', description: 'Create a customer record' },
  { resource: 'customers', action: 'update', description: 'Update customer profile details' },
  { resource: 'customers', action: 'delete', description: 'Remove a customer record' },

  // Transactions
  { resource: 'transactions', action: 'read', description: 'View transaction history' },
  { resource: 'transactions', action: 'create', description: 'Initiate a transaction' },
  { resource: 'transactions', action: 'approve', description: 'Approve a held/flagged transaction' },
  { resource: 'transactions', action: 'reject', description: 'Reject a held/flagged transaction' },
  { resource: 'transactions', action: 'reverse', description: 'Reverse a completed transaction' },

  // Transfer limits — admin-configurable ceilings (global/tier/customer/account-scoped, see TransferLimitsService)
  { resource: 'transfer_limits', action: 'read', description: 'View configured transfer limits' },
  { resource: 'transfer_limits', action: 'create', description: 'Set a transfer limit for a scope (global/tier/customer/account)' },
  { resource: 'transfer_limits', action: 'delete', description: 'Remove a scoped transfer limit override, reverting to the next broader scope' },

  // Beneficiaries
  { resource: 'beneficiaries', action: 'read', description: 'View saved beneficiaries' },
  { resource: 'beneficiaries', action: 'create', description: 'Add a beneficiary' },
  { resource: 'beneficiaries', action: 'update', description: 'Edit a beneficiary (nickname, favorite)' },
  { resource: 'beneficiaries', action: 'delete', description: 'Remove a beneficiary' },

  // Loans
  { resource: 'loans', action: 'read', description: 'View loan applications and accounts' },
  { resource: 'loans', action: 'create', description: 'Submit a loan application' },
  { resource: 'loans', action: 'update', description: 'Update a loan application or account' },
  { resource: 'loans', action: 'approve', description: 'Approve a loan application' },
  { resource: 'loans', action: 'reject', description: 'Reject a loan application' },
  { resource: 'loans', action: 'disburse', description: 'Disburse an approved loan' },

  // Savings
  { resource: 'savings', action: 'read', description: 'View savings plans/accounts' },
  { resource: 'savings', action: 'create', description: 'Create a savings plan' },
  { resource: 'savings', action: 'update', description: 'Update a savings plan' },
  { resource: 'savings', action: 'close', description: 'Close a savings plan' },

  // Statements
  { resource: 'statements', action: 'read', description: 'View a generated statement' },
  { resource: 'statements', action: 'generate', description: 'Generate a statement' },

  // Notifications
  { resource: 'notifications', action: 'read', description: 'View notification history' },
  { resource: 'notifications', action: 'send', description: 'Send an ad hoc notification' },

  // Support tickets
  { resource: 'support_tickets', action: 'read', description: 'View support tickets' },
  { resource: 'support_tickets', action: 'create', description: 'Create a support ticket' },
  { resource: 'support_tickets', action: 'update', description: 'Update a support ticket' },
  { resource: 'support_tickets', action: 'assign', description: 'Assign a ticket to an agent' },
  { resource: 'support_tickets', action: 'resolve', description: 'Resolve a support ticket' },
  { resource: 'support_tickets', action: 'escalate', description: 'Escalate a support ticket' },

  // Audit logs
  { resource: 'audit_logs', action: 'read', description: 'View audit log records' },
  { resource: 'audit_logs', action: 'export', description: 'Export audit log records' },

  // KYC
  { resource: 'kyc', action: 'read', description: 'View KYC applications and documents' },
  { resource: 'kyc', action: 'submit', description: 'Submit KYC documents' },
  { resource: 'kyc', action: 'approve', description: 'Approve a KYC application' },
  { resource: 'kyc', action: 'reject', description: 'Reject a KYC application' },

  // Reports
  { resource: 'reports', action: 'read', description: 'View a generated report' },
  { resource: 'reports', action: 'generate', description: 'Generate a report' },
  { resource: 'reports', action: 'export', description: 'Export a report' },

  // Users
  { resource: 'users', action: 'read', description: 'View user accounts' },
  { resource: 'users', action: 'create', description: 'Create a user account' },
  { resource: 'users', action: 'update', description: 'Update a user account' },
  { resource: 'users', action: 'delete', description: 'Delete a user account' },
  { resource: 'users', action: 'suspend', description: 'Suspend/reinstate a user account' },

  // Roles
  { resource: 'roles', action: 'read', description: 'View roles and their permissions' },
  { resource: 'roles', action: 'create', description: 'Create a role' },
  { resource: 'roles', action: 'update', description: 'Update a role (rename, re-parent, grant/revoke permissions)' },
  { resource: 'roles', action: 'delete', description: 'Delete a non-system role' },
  { resource: 'roles', action: 'assign', description: 'Assign a role to a user' },
  { resource: 'roles', action: 'revoke', description: 'Revoke a role from a user' },

  // System configuration
  { resource: 'system_config', action: 'read', description: 'View system/application configuration' },
  { resource: 'system_config', action: 'update', description: 'Update system/application configuration' },

  // API keys
  { resource: 'api_keys', action: 'read', description: 'View API keys (metadata only, never the secret)' },
  { resource: 'api_keys', action: 'create', description: 'Create an API key' },
  { resource: 'api_keys', action: 'revoke', description: 'Revoke an API key' },

  // Feature flags
  { resource: 'feature_flags', action: 'read', description: 'View feature flags' },
  { resource: 'feature_flags', action: 'create', description: 'Create a feature flag' },
  { resource: 'feature_flags', action: 'update', description: 'Update a feature flag' },
  { resource: 'feature_flags', action: 'toggle', description: 'Enable/disable a feature flag' },

  // Webhooks
  { resource: 'webhooks', action: 'read', description: 'View webhook endpoints' },
  { resource: 'webhooks', action: 'create', description: 'Register a webhook endpoint' },
  { resource: 'webhooks', action: 'update', description: 'Update a webhook endpoint' },
  { resource: 'webhooks', action: 'delete', description: 'Remove a webhook endpoint' },
];

export interface RoleDefinition {
  /** The `Role.name` unique key — SCREAMING_SNAKE_CASE, matching the existing seeded-role convention. */
  name: string;
  description: string;
  isSystemRole: true;
  /** Assigning this role requires maker-checker approval (RoleAssignmentApproval) rather than taking effect immediately. */
  isSensitive: boolean;
  /** `name` of the role this one inherits permissions from, if any — see docs/rbac.md § Role Hierarchy. */
  parentRoleName?: string;
  /** `resource:action` codes granted directly to this role (before hierarchy expansion). */
  permissions: string[];
}

const ALL_PERMISSION_CODES = PERMISSION_CATALOG.map((p) => permissionCode(p.resource, p.action));

/**
 * The canonical 10-role catalog (Phase 3B brief § System Roles). Every
 * grant here follows least privilege: a role only has the permissions its
 * job function actually needs, not a broader set "just in case" — see
 * docs/rbac.md for the reasoning behind each role's grant list.
 */
export const ROLE_CATALOG: RoleDefinition[] = [
  {
    name: 'CUSTOMER',
    description: 'Self-service only — never sees another customer\'s data. Scope is enforced by ownership checks, not by a narrower permission set.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:update',
      'accounts:read',
      'accounts:create',
      'accounts:update',
      'accounts:freeze',
      'transactions:read',
      'transactions:create',
      'beneficiaries:read',
      'beneficiaries:create',
      'beneficiaries:update',
      'beneficiaries:delete',
      'loans:read',
      'loans:create',
      'savings:read',
      'savings:create',
      'statements:read',
      'statements:generate',
      'notifications:read',
      'support_tickets:read',
      'support_tickets:create',
      'kyc:read',
      'kyc:submit',
    ],
  },
  {
    name: 'CUSTOMER_SUPPORT',
    description: 'Front-line customer support: view customer data, manage tickets, limited account actions.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:list',
      'customers:update',
      'accounts:read',
      'accounts:list',
      'accounts:freeze',
      'support_tickets:read',
      'support_tickets:create',
      'support_tickets:update',
      'support_tickets:assign',
      'support_tickets:escalate',
      'notifications:read',
      'notifications:send',
    ],
  },
  {
    name: 'OPERATIONS_OFFICER',
    description: 'Day-to-day banking operations: account lifecycle, standard transaction and savings processing.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:list',
      'customers:update',
      'accounts:read',
      'accounts:list',
      'accounts:create',
      'accounts:update',
      'accounts:freeze',
      'accounts:unfreeze',
      'accounts:close',
      'accounts:credit',
      'transactions:read',
      'transactions:create',
      'savings:read',
      'savings:create',
      'savings:update',
      'statements:read',
      'statements:generate',
    ],
  },
  {
    name: 'COMPLIANCE_OFFICER',
    description: 'KYC decisions, sanctions review, compliance-hold freezes, regulatory export.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:list',
      'kyc:read',
      'kyc:approve',
      'kyc:reject',
      'accounts:read',
      'accounts:list',
      'accounts:freeze',
      'accounts:unfreeze',
      'audit_logs:read',
      'reports:read',
      'reports:export',
    ],
  },
  {
    name: 'RISK_OFFICER',
    description: 'Transaction risk review, fraud-hold decisions, account risk freezes.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:list',
      'accounts:read',
      'accounts:list',
      'accounts:freeze',
      'accounts:unfreeze',
      'transactions:read',
      'transactions:approve',
      'transactions:reject',
      'transactions:reverse',
      'transfer_limits:read',
      'transfer_limits:create',
      'transfer_limits:delete',
      'loans:read',
      'reports:read',
      'audit_logs:read',
    ],
  },
  {
    name: 'LOAN_OFFICER',
    description: 'Loan application processing: review, approval, and disbursement.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:list',
      'accounts:read',
      'loans:read',
      'loans:create',
      'loans:update',
      'loans:approve',
      'loans:reject',
      'loans:disburse',
      'reports:read',
    ],
  },
  {
    name: 'FINANCE_OFFICER',
    description: 'Financial operations and reporting: transaction/statement oversight, regulatory and management reporting.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'accounts:read',
      'accounts:list',
      'transactions:read',
      'transactions:approve',
      'transactions:reject',
      'transfer_limits:read',
      'transfer_limits:create',
      'transfer_limits:delete',
      'statements:read',
      'statements:generate',
      'reports:read',
      'reports:generate',
      'reports:export',
      'audit_logs:read',
    ],
  },
  {
    name: 'AUDITOR',
    description: 'Read-only access to audit records, ledger/transaction detail, and regulatory reports. Never a write role.',
    isSystemRole: true,
    isSensitive: false,
    permissions: [
      'customers:read',
      'customers:list',
      'accounts:read',
      'accounts:list',
      'transactions:read',
      'transfer_limits:read',
      'loans:read',
      'savings:read',
      'statements:read',
      'kyc:read',
      'audit_logs:read',
      'audit_logs:export',
      'reports:read',
      'reports:export',
      'users:read',
      'roles:read',
    ],
  },
  {
    name: 'SYSTEM_ADMINISTRATOR',
    description: 'Staff/role management, system configuration, API keys, feature flags, webhooks — technical administration, deliberately excluding direct banking-data permissions (least privilege).',
    isSystemRole: true,
    isSensitive: true,
    permissions: [
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'users:suspend',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'roles:assign',
      'roles:revoke',
      'system_config:read',
      'system_config:update',
      'api_keys:read',
      'api_keys:create',
      'api_keys:revoke',
      'feature_flags:read',
      'feature_flags:create',
      'feature_flags:update',
      'feature_flags:toggle',
      'webhooks:read',
      'webhooks:create',
      'webhooks:update',
      'webhooks:delete',
      'audit_logs:read',
    ],
  },
  {
    name: 'SUPER_ADMINISTRATOR',
    description: 'Full system authority, including actions that affect Administrators themselves. Smallest possible group.',
    isSystemRole: true,
    isSensitive: true,
    parentRoleName: 'SYSTEM_ADMINISTRATOR',
    // Granted every permission explicitly (rather than relying solely on
    // hierarchy expansion) so the full-authority intent is visible directly
    // on the role's own grants, not just inferred from its parent — the
    // parent link still exists and is exercised (docs/rbac.md § Role
    // Hierarchy), but isn't the only source of Super Administrator's power.
    permissions: [...ALL_PERMISSION_CODES],
  },
];
