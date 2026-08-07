import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { StaffCustomerService } from './services/staff-customer.service';
import { StaffAccountService } from './services/staff-account.service';
import { StaffController } from './controllers/staff.controller';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [AuthzModule, TransactionsModule],
  controllers: [StaffController],
  providers: [StaffCustomerService, StaffAccountService],
})
export class StaffModule {}
