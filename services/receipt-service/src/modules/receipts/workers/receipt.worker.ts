import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionOptions, Job } from 'bullmq';
import { BaseWorker, BULLMQ_CONNECTION, QUEUE_NAMES } from '@ecoswift/queue';
import type { ReceiptJobPayload } from '@ecoswift/queue';
import { ReceiptGeneratorService } from '../services/receipt-generator.service';

/** Consumes `RECEIPTS_QUEUE` — `account-service`'s `SandboxTransactionService` is the current producer, enqueuing one job per completed sandbox deposit/withdrawal. */
@Injectable()
export class ReceiptWorker extends BaseWorker<ReceiptJobPayload> {
  protected readonly queueName = QUEUE_NAMES.RECEIPTS;

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: ConnectionOptions,
    private readonly receiptGenerator: ReceiptGeneratorService,
  ) {
    super(connection);
  }

  protected async process(job: Job<ReceiptJobPayload>): Promise<void> {
    await this.receiptGenerator.generate(job.data.transactionId);
  }
}
