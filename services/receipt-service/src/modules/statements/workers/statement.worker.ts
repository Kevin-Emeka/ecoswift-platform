import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConnectionOptions, Job } from 'bullmq';
import { BaseWorker, BULLMQ_CONNECTION, QUEUE_NAMES } from '@ecoswift/queue';
import type { StatementJobPayload } from '@ecoswift/queue';
import { PrismaService } from '@ecoswift/database';

/**
 * Consumes `STATEMENTS_QUEUE` — advances a `StatementRequest` through
 * QUEUED -> RUNNING -> COMPLETED and creates the corresponding `Statement`
 * row. Doesn't render or store any file itself: `StatementRendererService`
 * regenerates the actual PDF/CSV bytes fresh at download time (see its
 * doc comment for why), so this worker's only job is recording that
 * generation happened and when.
 */
@Injectable()
export class StatementWorker extends BaseWorker<StatementJobPayload> {
  protected readonly queueName = QUEUE_NAMES.STATEMENTS;
  private readonly workerLogger = new Logger(StatementWorker.name);

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: ConnectionOptions,
    private readonly prisma: PrismaService,
  ) {
    super(connection);
  }

  protected async process(job: Job<StatementJobPayload>): Promise<void> {
    const { statementRequestId, accountId, periodStart, periodEnd, format } = job.data;

    const claim = await this.prisma.statementRequest.updateMany({
      where: { id: statementRequestId, status: 'QUEUED' },
      data: { status: 'RUNNING' },
    });
    if (claim.count === 0) {
      this.workerLogger.log(`Statement request ${statementRequestId} is no longer QUEUED — skipping`);
      return;
    }

    const statement = await this.prisma.statement.create({
      data: {
        accountId,
        requestId: statementRequestId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        format: format as never,
      },
    });

    await this.prisma.statementRequest.update({
      where: { id: statementRequestId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    this.workerLogger.log(`Statement ${statement.id} ready for request ${statementRequestId}`);
  }
}
