import { SecurityEventQueryService } from './security-event-query.service';
import type { PrismaService } from '@ecoswift/database';

describe('SecurityEventQueryService', () => {
  let prisma: { securityEvent: { count: jest.Mock; findMany: jest.Mock } };
  let service: SecurityEventQueryService;

  beforeEach(() => {
    prisma = { securityEvent: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } };
    service = new SecurityEventQueryService(prisma as unknown as PrismaService);
  });

  it('paginates and maps security events, including the actor email', async () => {
    prisma.securityEvent.count.mockResolvedValue(3);
    prisma.securityEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        userId: 'user-1',
        user: { email: 'a@example.com' },
        eventType: 'LOGIN_FAILED',
        deviceId: null,
        ipAddress: '127.0.0.1',
        riskScore: null,
        metadata: null,
        createdAt: new Date('2026-01-01'),
      },
    ]);

    const result = await service.list({ page: 1, limit: 25 });

    expect(result.total).toBe(3);
    expect(result.items[0]!.userEmail).toBe('a@example.com');
    expect(result.items[0]!.eventType).toBe('LOGIN_FAILED');
  });

  it('filters by userId and eventType', async () => {
    await service.list({ page: 1, limit: 25, userId: 'user-1', eventType: 'SUSPICIOUS_SESSION' });
    const whereArg = prisma.securityEvent.findMany.mock.calls[0][0].where;
    expect(whereArg.userId).toBe('user-1');
    expect(whereArg.eventType).toBe('SUSPICIOUS_SESSION');
  });
});
