import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { NotificationCenterService } from './services/notification-center.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationTemplatesController } from './controllers/notification-templates.controller';
import { PushWorker } from './workers/push.worker';

@Module({
  imports: [AuthzModule],
  controllers: [NotificationsController, NotificationTemplatesController],
  providers: [NotificationCenterService, NotificationTemplateService, PushWorker],
})
export class NotificationsModule {}
