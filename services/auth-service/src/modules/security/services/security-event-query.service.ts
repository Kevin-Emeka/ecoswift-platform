import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import type { PaginatedResult } from '@ecoswift/types';
import type { ListSecurityEventsQueryDto } from '../dto/list-security-events-query.dto';
import type { SecurityEventResponseDto } from '../dto/security-event-response.dto';

/** A staff-facing read API over `SecurityEvent` — `SecurityEventService` (this same module) is the only writer, on every login/MFA/device/session-security signal since Phase 3C. Used by the admin panel's Security Events screen. */
@Injectable()
export class SecurityEventQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListSecurityEventsQueryDto): Promise<PaginatedResult<SecurityEventResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where: Prisma.SecurityEventWhereInput = {
      userId: query.userId,
      eventType: query.eventType as Prisma.SecurityEventWhereInput['eventType'],
    };

    const [total, events] = await Promise.all([
      this.prisma.securityEvent.count({ where }),
      this.prisma.securityEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
    ]);

    const items: SecurityEventResponseDto[] = events.map((event) => ({
      id: event.id,
      userId: event.userId ?? undefined,
      userEmail: event.user?.email,
      eventType: event.eventType,
      deviceId: event.deviceId ?? undefined,
      ipAddress: event.ipAddress ?? undefined,
      riskScore: event.riskScore?.toString(),
      metadata: event.metadata ?? undefined,
      createdAt: event.createdAt.toISOString(),
    }));

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
}
