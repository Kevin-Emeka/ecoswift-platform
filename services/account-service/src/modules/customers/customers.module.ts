import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { CustomerProfileService } from './services/customer-profile.service';
import { ConsentService } from './services/consent.service';
import { CustomerProfileController } from './controllers/customer-profile.controller';
import { ConsentController } from './controllers/consent.controller';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [AuthzModule],
  controllers: [CustomerProfileController, ConsentController],
  providers: [CustomerProfileService, ConsentService, AuditService],
  exports: [CustomerProfileService, ConsentService],
})
export class CustomersModule {}
