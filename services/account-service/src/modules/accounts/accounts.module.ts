import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { AccountNumberService } from './services/account-number.service';
import { LedgerIntegrationService } from './services/ledger-integration.service';
import { AccountService } from './services/account.service';
import { AccountStatusService } from './services/account-status.service';
import { AccountsController } from './controllers/accounts.controller';
import { AuditService } from '../../common/services/audit.service';
import { AccountNotificationService } from '../../common/services/account-notification.service';

@Module({
  imports: [AuthzModule],
  controllers: [AccountsController],
  providers: [
    AccountNumberService,
    LedgerIntegrationService,
    AccountService,
    AccountStatusService,
    AuditService,
    AccountNotificationService,
  ],
  exports: [AccountService, AccountStatusService],
})
export class AccountsModule {}
