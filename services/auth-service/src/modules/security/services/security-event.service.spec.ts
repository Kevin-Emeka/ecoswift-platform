import { SecurityEventService } from './security-event.service';
import type { PrismaService } from '@ecoswift/database';
import type { MetricsService } from '@ecoswift/observability';

describe('SecurityEventService', () => {
  let prisma: { securityEvent: { create: jest.Mock } };
  let metrics: { securityEventsTotal: { inc: jest.Mock } };
  let service: SecurityEventService;

  beforeEach(() => {
    prisma = { securityEvent: { create: jest.fn().mockResolvedValue({}) } };
    metrics = { securityEventsTotal: { inc: jest.fn() } };
    service = new SecurityEventService(prisma as unknown as PrismaService, metrics as unknown as MetricsService);
  });

  it('writes a SecurityEvent row with the given fields', async () => {
    await service.record({ userId: 'user-1', eventType: 'LOGIN_SUCCESS', ipAddress: '127.0.0.1' });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventType: 'LOGIN_SUCCESS',
        deviceId: undefined,
        ipAddress: '127.0.0.1',
        riskScore: undefined,
        metadata: undefined,
      },
    });
  });

  it('increments the security_events_total counter labeled by event type', async () => {
    await service.record({ eventType: 'SUSPICIOUS_SESSION' });
    expect(metrics.securityEventsTotal.inc).toHaveBeenCalledWith({ event_type: 'SUSPICIOUS_SESSION' });
  });

  it('increments the metric even for an event with no userId (e.g. an unattributed failed login)', async () => {
    await service.record({ eventType: 'LOGIN_FAILURE' });
    expect(prisma.securityEvent.create).toHaveBeenCalled();
    expect(metrics.securityEventsTotal.inc).toHaveBeenCalledWith({ event_type: 'LOGIN_FAILURE' });
  });
});
