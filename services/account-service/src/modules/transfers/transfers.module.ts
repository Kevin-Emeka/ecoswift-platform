import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { SecurityModule, FRAUD_HOOKS } from '@ecoswift/security';
import { BeneficiariesModule } from '../beneficiaries/beneficiaries.module';
import { TransfersController } from './controllers/transfers.controller';
import { InternalTransferService } from './services/internal-transfer.service';
import { ExternalTransferService } from './services/external-transfer.service';
import { TransferLimitsService } from './services/transfer-limits.service';
import { TransferRiskService } from './services/transfer-risk.service';
import { LedgerPostingService } from './services/ledger-posting.service';
import { AuditService } from '../../common/services/audit.service';
import { AccountNotificationService } from '../../common/services/account-notification.service';
import { TransferFraudHooksService } from '../../common/services/transfer-fraud-hooks.service';

/**
 * "Banking Service" / "Ledger Service" from the milestone 2 brief,
 * implemented as an intra-module boundary rather than two new deployable
 * services: `InternalTransferService` owns business validation
 * (ownership, balance, limits) and orchestration; `LedgerPostingService`
 * is the *only* class in this module permitted to write `JournalEntry`,
 * `JournalLine`, or `AccountBalance` rows. No controller, DTO, or
 * frontend touches those tables directly — see `LedgerPostingService`'s
 * doc comment.
 *
 * Imports `@ecoswift/security`'s `SecurityModule` for `EncryptionService`/
 * `TotpService`, but overrides its `FRAUD_HOOKS` binding locally with
 * `TransferFraudHooksService` — the first real (non-`Noop`) implementation
 * of that port in this codebase. The override is scoped to this module
 * only; `auth-service` keeps using the package default for its own
 * login/device call sites.
 */
@Module({
  imports: [AuthzModule, SecurityModule, BeneficiariesModule],
  controllers: [TransfersController],
  providers: [
    InternalTransferService,
    ExternalTransferService,
    TransferLimitsService,
    TransferRiskService,
    LedgerPostingService,
    AuditService,
    AccountNotificationService,
    { provide: FRAUD_HOOKS, useClass: TransferFraudHooksService },
  ],
  exports: [InternalTransferService, ExternalTransferService, AccountNotificationService, LedgerPostingService],
})
export class TransfersModule {}
