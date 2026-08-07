import { NotificationTemplateService } from './notification-template.service';
import type { PrismaService } from '@ecoswift/database';

describe('NotificationTemplateService', () => {
  it('lists templates ordered by channel then code, mapping optional fields', async () => {
    const prisma = {
      notificationTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { id: 't1', code: 'WELCOME', channel: 'EMAIL', subjectTemplate: 'Welcome', locale: 'en', isActive: true, updatedAt: new Date('2026-01-01') },
        ]),
      },
    };
    const service = new NotificationTemplateService(prisma as unknown as PrismaService);

    const result = await service.list();
    expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ channel: 'asc' }, { code: 'asc' }] }));
    expect(result[0]!.code).toBe('WELCOME');
    expect(result[0]!.isActive).toBe(true);
  });
});
