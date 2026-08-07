import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { TransferReviewController } from './controllers/transfer-review.controller';
import { TransferReviewService } from './services/transfer-review.service';
import { AuditService } from '../../common/services/audit.service';
import { TransfersModule } from '../transfers/transfers.module';

/**
 * The staff-facing counterpart to `TransfersModule`'s held-for-review
 * path. Imports `TransfersModule` for `LedgerPostingService` (the only
 * class allowed to write ledger entries) and `AccountNotificationService`
 * — both already exported from there for exactly this kind of reuse.
 */
@Module({
  imports: [AuthzModule, TransfersModule],
  controllers: [TransferReviewController],
  providers: [TransferReviewService, AuditService],
})
export class TransferReviewModule {}
