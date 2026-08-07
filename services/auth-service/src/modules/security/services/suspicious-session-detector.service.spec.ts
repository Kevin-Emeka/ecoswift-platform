import { SuspiciousSessionDetectorService } from './suspicious-session-detector.service';
import type { PrismaService } from '@ecoswift/database';
import type { ConfigurationService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { SecurityEventService } from './security-event.service';

describe('SuspiciousSessionDetectorService', () => {
  let prisma: { session: { findFirst: jest.Mock } };
  let configurationService: { getNumber: jest.Mock };
  let securityEvents: jest.Mocked<Pick<SecurityEventService, 'record'>>;
  let eventPublisher: { publish: jest.Mock };
  let service: SuspiciousSessionDetectorService;

  beforeEach(() => {
    prisma = { session: { findFirst: jest.fn() } };
    configurationService = { getNumber: jest.fn().mockResolvedValue(5) };
    securityEvents = { record: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new SuspiciousSessionDetectorService(
      prisma as unknown as PrismaService,
      configurationService as unknown as ConfigurationService,
      securityEvents as unknown as SecurityEventService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  it('does nothing when there is no other recent active session from a different IP', async () => {
    prisma.session.findFirst.mockResolvedValue(null);
    await service.evaluate('user-1', 'session-new', '10.0.0.1');
    expect(securityEvents.record).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('flags when another active session from a different IP exists within the window', async () => {
    prisma.session.findFirst.mockResolvedValue({ id: 'session-old', ipAddress: '203.0.113.5' });

    await service.evaluate('user-1', 'session-new', '10.0.0.1');

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', eventType: 'SUSPICIOUS_SESSION' }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'security.suspicious_session_detected',
        payload: expect.objectContaining({ previousIpAddress: '203.0.113.5', newIpAddress: '10.0.0.1' }),
      }),
    );
  });

  it('excludes the new session itself and same-IP sessions from the comparison query', async () => {
    prisma.session.findFirst.mockResolvedValue(null);
    await service.evaluate('user-1', 'session-new', '10.0.0.1');

    const query = prisma.session.findFirst.mock.calls[0][0];
    expect(query.where.id).toEqual({ not: 'session-new' });
    expect(query.where.ipAddress).toEqual({ not: '10.0.0.1' });
    expect(query.where.status).toBe('ACTIVE');
  });

  it('reads the comparison window from ConfigurationService, falling back to the default', async () => {
    prisma.session.findFirst.mockResolvedValue(null);
    await service.evaluate('user-1', 'session-new', '10.0.0.1');
    expect(configurationService.getNumber).toHaveBeenCalledWith('session.suspicious_ip_change_window_minutes', 5);
  });

  it('never throws even when it flags — this is detection, not enforcement', async () => {
    prisma.session.findFirst.mockResolvedValue({ id: 'session-old', ipAddress: '203.0.113.5' });
    await expect(service.evaluate('user-1', 'session-new', '10.0.0.1')).resolves.toBeUndefined();
  });
});
