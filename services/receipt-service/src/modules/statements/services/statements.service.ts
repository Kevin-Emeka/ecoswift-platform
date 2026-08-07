import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { STATEMENTS_QUEUE } from '@ecoswift/queue';
import type { QueuePort, StatementJobPayload } from '@ecoswift/queue';
import type { RequestStatementDto, StatementRequestResponseDto } from '../dto/statement.dto';

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STATEMENTS_QUEUE) private readonly statementsQueue: QueuePort<StatementJobPayload>,
  ) {}

  async request(userId: string, accountId: string, dto: RequestStatementDto): Promise<StatementRequestResponseDto> {
    const account = await this.loadOwnedAccount(userId, accountId);
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new NotFoundException('periodEnd must be on or after periodStart');
    }

    const statementRequest = await this.prisma.statementRequest.create({
      data: {
        requestedBy: userId,
        accountId: account.id,
        periodStart,
        periodEnd,
        format: dto.format,
        status: 'QUEUED',
      },
    });

    await this.statementsQueue.enqueue({
      statementRequestId: statementRequest.id,
      accountId: account.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      format: dto.format,
    });

    return this.toResponseDto(statementRequest);
  }

  async list(userId: string): Promise<StatementRequestResponseDto[]> {
    const requests = await this.prisma.statementRequest.findMany({
      where: { account: { customer: { userId } } },
      include: { statements: true },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => this.toResponseDto(r, r.statements[0]?.id));
  }

  /** Resolves a `Statement` for download, verifying the caller owns the account it belongs to. Returns the account + period so the caller can re-render fresh transaction data. */
  async loadOwnedStatementForDownload(userId: string, statementId: string) {
    const statement = await this.prisma.statement.findUnique({
      where: { id: statementId },
      include: { account: { include: { customer: true, currency: true } } },
    });
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }
    if (statement.account.customer.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return statement;
  }

  private async loadOwnedAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, include: { customer: true } });
    if (!account || account.customer.userId !== userId) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  private toResponseDto(
    request: { id: string; accountId: string; periodStart: Date; periodEnd: Date; format: string; status: string; completedAt: Date | null; createdAt: Date },
    statementId?: string,
  ): StatementRequestResponseDto {
    return {
      id: request.id,
      accountId: request.accountId,
      periodStart: request.periodStart.toISOString(),
      periodEnd: request.periodEnd.toISOString(),
      format: request.format,
      status: request.status,
      statementId,
      completedAt: request.completedAt?.toISOString(),
      createdAt: request.createdAt.toISOString(),
    };
  }
}
