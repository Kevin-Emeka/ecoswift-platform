import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { TransferLimitsAdminController } from './controllers/transfer-limits-admin.controller';
import { TransferLimitsAdminService } from './services/transfer-limits-admin.service';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [AuthzModule],
  controllers: [TransferLimitsAdminController],
  providers: [TransferLimitsAdminService, AuditService],
})
export class TransferLimitsAdminModule {}
