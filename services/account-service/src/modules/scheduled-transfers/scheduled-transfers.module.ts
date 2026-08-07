import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { ScheduledTransfersController, ScheduledTransfersQueryController } from './controllers/scheduled-transfers.controller';
import { ScheduledTransfersService } from './services/scheduled-transfers.service';
import { ScheduledTransferWorker } from './workers/scheduled-transfer.worker';
import { AuditService } from '../../common/services/audit.service';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [AuthzModule, TransfersModule],
  controllers: [ScheduledTransfersController, ScheduledTransfersQueryController],
  providers: [ScheduledTransfersService, ScheduledTransferWorker, AuditService],
})
export class ScheduledTransfersModule {}
