import { Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import { SessionService } from '../services/session.service';
import { SessionResponseDto } from '../dto/session-response.dto';
import { MessageResponseDto } from '../dto/message-response.dto';

/**
 * Session Management: multiple devices, listing, and revocation. See
 * docs/session-management.md — a customer can see every place they're
 * signed in and end any of them individually, or "sign out everywhere
 * else" in one action, without needing to know their own current password
 * again (they're already authenticated).
 */
@ApiTags('sessions')
@ApiBearerAuth('access-token')
@Controller({ path: 'sessions', version: '1' })
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'List your active sessions across all devices' })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionService.listForUser(user.userId);
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent ?? undefined,
      deviceName: session.device?.deviceName ?? undefined,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === user.sessionId,
    }));
  }

  @Get('user/:userId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('users:read')
  @ApiOperation({ summary: "Staff-only: view any user's active sessions (admin panel Session Viewer)" })
  async listForUser(@Param('userId', ParseUUIDPipe) userId: string): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionService.listForUser(userId);
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent ?? undefined,
      deviceName: session.device?.deviceName ?? undefined,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      isCurrent: false,
    }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<MessageResponseDto> {
    const session = await this.sessionService.findActiveById(sessionId);
    if (session && session.userId !== user.userId) {
      // Deliberately 403, not 404 — this session id is real, just not
      // yours; a 404 here would help an attacker enumerate valid session
      // ids across other users.
      throw new ForbiddenException('You do not have access to this session');
    }
    await this.sessionService.revoke(sessionId, 'USER_REVOKED');
    return { message: 'Session revoked.' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every session except the one making this request ("sign out everywhere else")' })
  async revokeAllOthers(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.sessionService.revokeAllForUser(user.userId, 'USER_REVOKED_ALL_OTHERS', user.sessionId);
    return { message: 'Every other session has been signed out.' };
  }
}
