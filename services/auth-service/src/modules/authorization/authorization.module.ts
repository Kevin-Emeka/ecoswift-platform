import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { ConfigurationModule } from '@ecoswift/config';
import { RolesController } from './controllers/roles.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { UserRolesController } from './controllers/user-roles.controller';
import { RoleAssignmentApprovalsController } from './controllers/role-assignment-approvals.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { AuthorizationController } from './controllers/authorization.controller';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { UserRoleService } from './services/user-role.service';
import { RoleAssignmentApprovalService } from './services/role-assignment-approval.service';
import { ApiKeyService } from './services/api-key.service';
import { FeatureFlagAdminService } from './services/feature-flag-admin.service';
import { AuthorizationAuditService } from './services/authorization-audit.service';

/**
 * Phase 3B — Authorization, Access Control & Compliance. See
 * docs/authorization.md, docs/rbac.md, docs/permission-matrix.md,
 * docs/compliance-controls.md.
 *
 * Imports `AuthzModule` (`@ecoswift/authz`) for `PermissionsGuard`,
 * `PolicyEngineService`, and the resolver/validator ports every controller
 * and service here depends on — the same package any *other* service will
 * import to enforce these same permissions on its own endpoints in a later
 * phase.
 */
@Module({
  imports: [AuthzModule, ConfigurationModule],
  controllers: [
    RolesController,
    PermissionsController,
    UserRolesController,
    RoleAssignmentApprovalsController,
    ApiKeysController,
    FeatureFlagsController,
    AuthorizationController,
  ],
  providers: [
    RoleService,
    PermissionService,
    UserRoleService,
    RoleAssignmentApprovalService,
    ApiKeyService,
    FeatureFlagAdminService,
    AuthorizationAuditService,
  ],
  exports: [AuthorizationAuditService],
})
export class AuthorizationModule {}
