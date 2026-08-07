import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { ReceiptGeneratorService } from './services/receipt-generator.service';
import { ReceiptQueryService } from './services/receipt-query.service';
import { ReceiptPdfService } from './services/receipt-pdf.service';
import { ReceiptsController } from './controllers/receipts.controller';
import { ReceiptWorker } from './workers/receipt.worker';

@Module({
  imports: [AuthzModule],
  controllers: [ReceiptsController],
  providers: [ReceiptGeneratorService, ReceiptQueryService, ReceiptPdfService, ReceiptWorker],
})
export class ReceiptsModule {}
