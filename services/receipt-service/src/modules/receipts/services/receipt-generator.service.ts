import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';

/** Same "which transaction types are fabricated vs. real" distinction as account-service's `TransactionQueryService` — see that class's comment. */
const SANDBOX_TYPE_CODES = new Set(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_EXTERNAL']);

/**
 * Consumed by `ReceiptWorker` — builds and persists a `Receipt` row from a
 * completed `Transaction`. `content` (JSON) is the source of truth for a
 * receipt's data; `ReceiptPdfService` renders it into a PDF on demand at
 * download time rather than storing a second, binary copy — see that
 * service's doc comment.
 */
@Injectable()
export class ReceiptGeneratorService {
  private readonly logger = new Logger(ReceiptGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generate(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        transactionType: true,
        currency: true,
        sourceAccount: {
          include: { customer: { include: { user: { include: { profile: true } } } } },
        },
        destinationAccount: {
          include: { customer: { include: { user: { include: { profile: true } } } } },
        },
        transferRequest: { include: { destinationBeneficiary: true } },
      },
    });

    if (!transaction) {
      this.logger.warn(`Cannot generate receipt — transaction ${transactionId} not found`);
      return;
    }

    const referenceNumber = await this.generateReferenceNumber();
    const senderName = this.holderName(transaction.sourceAccount);
    const beneficiary = transaction.transferRequest?.destinationBeneficiary;
    const recipientName =
      this.holderName(transaction.destinationAccount) ?? beneficiary?.beneficiaryName;

    const content = {
      receiptReference: referenceNumber,
      transactionReference: transaction.transactionReference,
      transactionType: transaction.transactionType.code,
      status: transaction.status,
      amount: transaction.amount.toString(),
      currencyCode: transaction.currency.isoCode,
      sourceAccountNumber: transaction.sourceAccount?.accountNumber,
      destinationAccountNumber:
        transaction.destinationAccount?.accountNumber ?? beneficiary?.accountNumber,
      senderName,
      recipientName,
      // Only populated for wire transfers (destinationBeneficiary present) —
      // lets ReceiptPdfService render a full beneficiary-bank section for
      // wires without needing a second content shape.
      beneficiaryBankName: beneficiary?.bankName,
      beneficiarySwiftBic: beneficiary?.swiftBic,
      beneficiaryBankAddress: beneficiary?.bankAddress,
      beneficiaryBankCountryCode: beneficiary?.bankCountryCode,
      beneficiaryRoutingNumber: beneficiary?.routingNumber,
      description: transaction.description,
      sandbox: SANDBOX_TYPE_CODES.has(transaction.transactionType.code),
      issuedAt: new Date().toISOString(),
      transactionCreatedAt: transaction.createdAt.toISOString(),
      transactionCompletedAt: transaction.completedAt?.toISOString(),
    };

    await this.prisma.receipt.create({
      data: { transactionId, referenceNumber, format: 'JSON', content },
    });
  }

  private holderName(
    account: {
      customer: { user: { profile: { firstName: string; lastName: string } | null } };
    } | null,
  ): string | undefined {
    const profile = account?.customer.user.profile;
    return profile ? `${profile.firstName} ${profile.lastName}` : undefined;
  }

  private async generateReferenceNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `RCT${randomInt(100_000_000, 999_999_999)}`;
      const existing = await this.prisma.receipt.findUnique({
        where: { referenceNumber: candidate },
      });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique receipt reference number');
  }
}
