import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { ReceiptResponseDto } from '../dto/receipt-response.dto';

@Injectable()
export class ReceiptQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getByTransactionId(userId: string, transactionId: string): Promise<ReceiptResponseDto> {
    const transaction = await this.loadOwnedTransaction(userId, transactionId);
    const receipt = await this.prisma.receipt.findFirst({ where: { transactionId: transaction.id }, orderBy: { generatedAt: 'desc' } });
    if (!receipt) {
      throw new NotFoundException('No receipt has been generated for this transaction yet');
    }
    return this.toResponseDto(receipt);
  }

  /** Every receipt for a transaction touching any account the caller owns, newest first. */
  async listMine(userId: string): Promise<ReceiptResponseDto[]> {
    const receipts = await this.prisma.receipt.findMany({
      where: {
        transaction: {
          OR: [{ sourceAccount: { customer: { userId } } }, { destinationAccount: { customer: { userId } } }],
        },
      },
      orderBy: { generatedAt: 'desc' },
    });
    return receipts.map((r) => this.toResponseDto(r));
  }

  async loadOwnedTransaction(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { sourceAccount: { include: { customer: true } }, destinationAccount: { include: { customer: true } } },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const ownsSource = transaction.sourceAccount?.customer.userId === userId;
    const ownsDestination = transaction.destinationAccount?.customer.userId === userId;
    if (!ownsSource && !ownsDestination) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return transaction;
  }

  private toResponseDto(receipt: { id: string; referenceNumber: string; format: string; content: unknown; generatedAt: Date }): ReceiptResponseDto {
    return {
      id: receipt.id,
      referenceNumber: receipt.referenceNumber,
      format: receipt.format,
      content: receipt.content as Record<string, unknown>,
      generatedAt: receipt.generatedAt.toISOString(),
    };
  }
}
