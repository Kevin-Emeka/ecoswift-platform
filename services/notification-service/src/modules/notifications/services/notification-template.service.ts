import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { NotificationTemplateResponseDto } from '../dto/notification-template-response.dto';

/** Staff-facing read view of the seeded `NotificationTemplate` catalog (`prisma/seed.ts`) — the admin panel's Notification Management screen. */
@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<NotificationTemplateResponseDto[]> {
    const templates = await this.prisma.notificationTemplate.findMany({ orderBy: [{ channel: 'asc' }, { code: 'asc' }] });
    return templates.map((template) => ({
      id: template.id,
      code: template.code,
      channel: template.channel,
      subjectTemplate: template.subjectTemplate ?? undefined,
      locale: template.locale,
      isActive: template.isActive,
      updatedAt: template.updatedAt.toISOString(),
    }));
  }
}
