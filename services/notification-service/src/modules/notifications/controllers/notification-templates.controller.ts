import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { NotificationTemplateService } from '../services/notification-template.service';
import type { NotificationTemplateResponseDto } from '../dto/notification-template-response.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'notification-templates', version: '1' })
export class NotificationTemplatesController {
  constructor(private readonly notificationTemplateService: NotificationTemplateService) {}

  @Get()
  @RequirePermissions('notifications:send')
  @ApiOperation({ summary: 'List the notification template catalog (staff only — admin panel Notification Management)' })
  async list(): Promise<NotificationTemplateResponseDto[]> {
    return this.notificationTemplateService.list();
  }
}
