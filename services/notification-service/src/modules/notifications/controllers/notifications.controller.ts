import { Controller, Get, Param, Patch, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser, type AuthenticatedUser } from '@ecoswift/auth-client';
import type { PaginatedResult } from '@ecoswift/types';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { NotificationCenterService } from '../services/notification-center.service';
import { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import type { NotificationResponseDto } from '../dto/notification-response.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationCenterService: NotificationCenterService) {}

  @Get()
  @RequirePermissions('notifications:read')
  @ApiOperation({ summary: "The caller's own notifications, newest first" })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsQueryDto): Promise<PaginatedResult<NotificationResponseDto>> {
    return this.notificationCenterService.list(user.userId, query);
  }

  @Get('unread-count')
  @RequirePermissions('notifications:read')
  @ApiOperation({ summary: 'Unread notification count for the caller — for a badge/counter in the UI' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.notificationCenterService.unreadCount(user.userId);
    return { count };
  }

  @Patch(':id/read')
  @RequirePermissions('notifications:read')
  @ApiOperation({ summary: "Mark one of the caller's own notifications as read" })
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<NotificationResponseDto> {
    return this.notificationCenterService.markRead(user.userId, id);
  }

  @Patch('read-all')
  @RequirePermissions('notifications:read')
  @ApiOperation({ summary: "Mark all of the caller's unread notifications as read" })
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    return this.notificationCenterService.markAllRead(user.userId);
  }
}
