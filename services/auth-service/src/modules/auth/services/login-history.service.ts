import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';

export interface RecordLoginAttemptInput {
  userId: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress: string;
  userAgent?: string;
  successful: boolean;
  failureReason?: string;
}

/** Append-only login attempt log (`LoginHistory`, Phase 2B schema) — every attempt, successful or not. */
@Injectable()
export class LoginHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordLoginAttemptInput): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        successful: input.successful,
        failureReason: input.failureReason,
      },
    });
  }

  async listForUser(userId: string, limit = 20) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { loggedInAt: 'desc' },
      take: limit,
    });
  }
}
