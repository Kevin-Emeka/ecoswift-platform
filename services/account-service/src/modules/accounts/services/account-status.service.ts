import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { EVENT_PUBLISHER, ACCOUNT_STATUS_CHANGED } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { AuditService } from '../../../common/services/audit.service';

const ACCOUNT_STATUSES = ['PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED', 'RESTRICTED'] as const;
type AccountStatusLiteral = (typeof ACCOUNT_STATUSES)[number];

function isAccountStatus(value: string): value is AccountStatusLiteral {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/**
 * The full `AccountStatus` lifecycle (Phase 4A brief: "Support: Pending,
 * Active, Frozen, Dormant, Closed, Restricted"). Every legal transition is
 * listed explicitly — anything not in this table is rejected with a 400,
 * not silently allowed. `CLOSED` is terminal (no outbound edges): a
 * closed account can never be reopened, matching real banking practice
 * (a new account is opened instead).
 */
const LEGAL_TRANSITIONS: Record<AccountStatusLiteral, AccountStatusLiteral[]> = {
  PENDING_ACTIVATION: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['FROZEN', 'DORMANT', 'RESTRICTED', 'CLOSED'],
  FROZEN: ['ACTIVE', 'CLOSED'],
  DORMANT: ['ACTIVE', 'CLOSED'],
  RESTRICTED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

@Injectable()
export class AccountStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async transition(
    accountId: string,
    targetStatus: string,
    actor: { userId: string; actorType: 'CUSTOMER' | 'STAFF' },
    reason?: string,
  ): Promise<{ id: string; status: string }> {
    if (!isAccountStatus(targetStatus)) {
      throw new BadRequestException(`Unknown account status "${targetStatus}"`);
    }

    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const allowed = LEGAL_TRANSITIONS[account.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(`Cannot transition account from ${account.status} to ${targetStatus}`);
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        status: targetStatus,
        closedAt: targetStatus === 'CLOSED' ? new Date() : account.closedAt,
      },
    });

    await this.auditService.record({
      actorUserId: actor.userId,
      actorType: actor.actorType,
      actionType: this.actionTypeFor(targetStatus),
      resourceType: 'Account',
      resourceId: accountId,
      description: reason,
      beforeState: { status: account.status },
      afterState: { status: updated.status },
    });

    await this.eventPublisher.publish({
      eventType: ACCOUNT_STATUS_CHANGED,
      producerContext: 'account-service',
      payload: { accountId, previousStatus: account.status, newStatus: updated.status, reason },
    });

    return { id: updated.id, status: updated.status };
  }

  private actionTypeFor(targetStatus: string): 'UPDATE' | 'FREEZE' | 'UNFREEZE' {
    if (targetStatus === 'FROZEN' || targetStatus === 'RESTRICTED') return 'FREEZE';
    if (targetStatus === 'ACTIVE') return 'UNFREEZE';
    return 'UPDATE';
  }
}
