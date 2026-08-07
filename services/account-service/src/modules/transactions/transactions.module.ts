import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { SandboxTransactionService } from './services/sandbox-transaction.service';
import { TransactionQueryService } from './services/transaction-query.service';
import { TransactionsController } from './controllers/transactions.controller';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [AuthzModule],
  controllers: [TransactionsController],
  providers: [SandboxTransactionService, TransactionQueryService, AuditService],
  exports: [SandboxTransactionService],
})
export class TransactionsModule {}
