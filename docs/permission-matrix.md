# Ecoswift Bank — Permission Matrix

**Phase 3B deliverable — generated from `packages/authz/src/catalog/permission-catalog.ts`, not hand-maintained.** Regenerate after any change to `PERMISSION_CATALOG`/`ROLE_CATALOG` rather than editing this file directly — see [`rbac.md`](rbac.md) for the reasoning behind each role's grant list, and [`authorization.md`](authorization.md) for how these permissions are actually enforced at request time.

✅ marks a role's **effective** permission — direct grants plus everything inherited through role hierarchy (`rbac.md` § Role Hierarchy). Super Administrator shows every permission both because it inherits System Administrator's grants *and* because it is separately granted the full catalog directly (see the catalog file's own comment on why both).

69 permissions across 17 resources; 10 roles.

---

## accounts

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `accounts:read` — View account details and balances | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ |
| `accounts:list` — Browse/search accounts across all customers (staff) |  | ✅ | ✅ | ✅ | ✅ |  | ✅ | ✅ |  | ✅ |
| `accounts:create` — Open a new account | ✅ |  | ✅ |  |  |  |  |  |  | ✅ |
| `accounts:update` — Update account details | ✅ |  | ✅ |  |  |  |  |  |  | ✅ |
| `accounts:freeze` — Freeze an account | ✅ | ✅ | ✅ | ✅ | ✅ |  |  |  |  | ✅ |
| `accounts:unfreeze` — Unfreeze a previously frozen account |  |  | ✅ | ✅ |  |  |  |  |  | ✅ |
| `accounts:close` — Close an account |  |  | ✅ |  |  |  |  |  |  | ✅ |

## customers

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `customers:read` — View customer profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ |  | ✅ |
| `customers:list` — Browse/search customers across the bank (staff) |  | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ |  | ✅ |
| `customers:create` — Create a customer record |  |  |  |  |  |  |  |  |  | ✅ |
| `customers:update` — Update customer profile details | ✅ | ✅ | ✅ |  |  |  |  |  |  | ✅ |
| `customers:delete` — Remove a customer record |  |  |  |  |  |  |  |  |  | ✅ |

## transactions

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `transactions:read` — View transaction history | ✅ |  | ✅ |  | ✅ |  | ✅ | ✅ |  | ✅ |
| `transactions:create` — Initiate a transaction | ✅ |  | ✅ |  |  |  |  |  |  | ✅ |
| `transactions:approve` — Approve a held/flagged transaction |  |  |  |  | ✅ |  | ✅ |  |  | ✅ |
| `transactions:reverse` — Reverse a completed transaction |  |  |  |  | ✅ |  |  |  |  | ✅ |

## loans

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `loans:read` — View loan applications and accounts | ✅ |  |  |  | ✅ | ✅ |  | ✅ |  | ✅ |
| `loans:create` — Submit a loan application | ✅ |  |  |  |  | ✅ |  |  |  | ✅ |
| `loans:update` — Update a loan application or account |  |  |  |  |  | ✅ |  |  |  | ✅ |
| `loans:approve` — Approve a loan application |  |  |  |  |  | ✅ |  |  |  | ✅ |
| `loans:reject` — Reject a loan application |  |  |  |  |  | ✅ |  |  |  | ✅ |
| `loans:disburse` — Disburse an approved loan |  |  |  |  |  | ✅ |  |  |  | ✅ |

## savings

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `savings:read` — View savings plans/accounts | ✅ |  | ✅ |  |  |  |  | ✅ |  | ✅ |
| `savings:create` — Create a savings plan | ✅ |  | ✅ |  |  |  |  |  |  | ✅ |
| `savings:update` — Update a savings plan |  |  | ✅ |  |  |  |  |  |  | ✅ |
| `savings:close` — Close a savings plan |  |  |  |  |  |  |  |  |  | ✅ |

## statements

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `statements:read` — View a generated statement | ✅ |  | ✅ |  |  |  | ✅ | ✅ |  | ✅ |
| `statements:generate` — Generate a statement |  |  | ✅ |  |  |  | ✅ |  |  | ✅ |

## notifications

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `notifications:read` — View notification history | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| `notifications:send` — Send an ad hoc notification |  | ✅ |  |  |  |  |  |  |  | ✅ |

## support_tickets

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `support_tickets:read` — View support tickets | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| `support_tickets:create` — Create a support ticket | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| `support_tickets:update` — Update a support ticket |  | ✅ |  |  |  |  |  |  |  | ✅ |
| `support_tickets:assign` — Assign a ticket to an agent |  | ✅ |  |  |  |  |  |  |  | ✅ |
| `support_tickets:resolve` — Resolve a support ticket |  |  |  |  |  |  |  |  |  | ✅ |
| `support_tickets:escalate` — Escalate a support ticket |  | ✅ |  |  |  |  |  |  |  | ✅ |

## audit_logs

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `audit_logs:read` — View audit log records |  |  |  | ✅ | ✅ |  | ✅ | ✅ | ✅ | ✅ |
| `audit_logs:export` — Export audit log records |  |  |  |  |  |  |  | ✅ |  | ✅ |

## kyc

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `kyc:read` — View KYC applications and documents | ✅ |  |  | ✅ |  |  |  | ✅ |  | ✅ |
| `kyc:submit` — Submit KYC documents | ✅ |  |  |  |  |  |  |  |  | ✅ |
| `kyc:approve` — Approve a KYC application |  |  |  | ✅ |  |  |  |  |  | ✅ |
| `kyc:reject` — Reject a KYC application |  |  |  | ✅ |  |  |  |  |  | ✅ |

## reports

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `reports:read` — View a generated report |  |  |  | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ |
| `reports:generate` — Generate a report |  |  |  |  |  |  | ✅ |  |  | ✅ |
| `reports:export` — Export a report |  |  |  | ✅ |  |  | ✅ | ✅ |  | ✅ |

## users

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `users:read` — View user accounts |  |  |  |  |  |  |  | ✅ | ✅ | ✅ |
| `users:create` — Create a user account |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `users:update` — Update a user account |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `users:delete` — Delete a user account |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `users:suspend` — Suspend/reinstate a user account |  |  |  |  |  |  |  |  | ✅ | ✅ |

## roles

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `roles:read` — View roles and their permissions |  |  |  |  |  |  |  | ✅ | ✅ | ✅ |
| `roles:create` — Create a role |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `roles:update` — Update a role (rename, re-parent, grant/revoke permissions) |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `roles:delete` — Delete a non-system role |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `roles:assign` — Assign a role to a user |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `roles:revoke` — Revoke a role from a user |  |  |  |  |  |  |  |  | ✅ | ✅ |

## system_config

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `system_config:read` — View system/application configuration |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `system_config:update` — Update system/application configuration |  |  |  |  |  |  |  |  | ✅ | ✅ |

## api_keys

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `api_keys:read` — View API keys (metadata only, never the secret) |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `api_keys:create` — Create an API key |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `api_keys:revoke` — Revoke an API key |  |  |  |  |  |  |  |  | ✅ | ✅ |

## feature_flags

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `feature_flags:read` — View feature flags |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `feature_flags:create` — Create a feature flag |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `feature_flags:update` — Update a feature flag |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `feature_flags:toggle` — Enable/disable a feature flag |  |  |  |  |  |  |  |  | ✅ | ✅ |

## webhooks

| Permission | CUSTOMER | CUSTOMER SUPPORT | OPERATIONS OFFICER | COMPLIANCE OFFICER | RISK OFFICER | LOAN OFFICER | FINANCE OFFICER | AUDITOR | SYSTEM ADMINISTRATOR | SUPER ADMINISTRATOR |
|---|---|---|---|---|---|---|---|---|---|---|
| `webhooks:read` — View webhook endpoints |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `webhooks:create` — Register a webhook endpoint |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `webhooks:update` — Update a webhook endpoint |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `webhooks:delete` — Remove a webhook endpoint |  |  |  |  |  |  |  |  | ✅ | ✅ |
