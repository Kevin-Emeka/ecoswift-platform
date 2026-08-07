import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MessageResponseDto } from '../../auth/dto/message-response.dto';
import { RoleAssignmentApprovalService } from '../services/role-assignment-approval.service';
import { RejectApprovalDto } from '../dto/reject-approval.dto';

/**
 * Administrative Approval Hooks (docs/compliance-controls.md) — the
 * maker-checker queue for sensitive role assignments. Approving/rejecting
 * requires the same `roles:assign` permission that requesting one does;
 * what's structurally enforced (not just permission-gated) is that the
 * reviewer can't be the requester — see `RoleAssignmentApprovalService`.
 */
@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'role-assignment-approvals', version: '1' })
@UseGuards(PermissionsGuard)
export class RoleAssignmentApprovalsController {
  constructor(private readonly approvalService: RoleAssignmentApprovalService) {}

  @Get()
  @RequirePermissions('roles:assign')
  @ApiOperation({ summary: 'List pending sensitive-role assignment requests' })
  async listPending() {
    return this.approvalService.listPending();
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('roles:assign')
  @ApiOperation({ summary: 'Approve a pending role assignment request' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.approvalService.approve(id, user.userId);
    return { message: 'Role assignment approved.' };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('roles:assign')
  @ApiOperation({ summary: 'Reject a pending role assignment request' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.approvalService.reject(id, user.userId, dto.reviewNote);
    return { message: 'Role assignment rejected.' };
  }
}
