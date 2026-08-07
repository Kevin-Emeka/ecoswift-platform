import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { BeneficiariesController } from './controllers/beneficiaries.controller';
import { BeneficiariesService } from './services/beneficiaries.service';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [AuthzModule],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService, AuditService],
  exports: [BeneficiariesService],
})
export class BeneficiariesModule {}
