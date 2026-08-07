import { Controller, Get, Param, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser, type AuthenticatedUser } from '@ecoswift/auth-client';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { ReceiptQueryService } from '../services/receipt-query.service';
import { ReceiptPdfService } from '../services/receipt-pdf.service';
import type { ReceiptResponseDto } from '../dto/receipt-response.dto';

@ApiTags('receipts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'receipts', version: '1' })
export class ReceiptsController {
  constructor(
    private readonly receiptQueryService: ReceiptQueryService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  @Get()
  @RequirePermissions('transactions:read')
  @ApiOperation({ summary: "List every receipt for a transaction on an account the caller owns, newest first" })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ReceiptResponseDto[]> {
    return this.receiptQueryService.listMine(user.userId);
  }

  @Get('transaction/:transactionId')
  @RequirePermissions('transactions:read')
  @ApiOperation({ summary: 'Get the receipt for a transaction on an account the caller owns' })
  async getByTransaction(@CurrentUser() user: AuthenticatedUser, @Param('transactionId') transactionId: string): Promise<ReceiptResponseDto> {
    return this.receiptQueryService.getByTransactionId(user.userId, transactionId);
  }

  @Get('transaction/:transactionId/download')
  @RequirePermissions('transactions:read')
  @ApiOperation({ summary: 'Download the receipt for a transaction on an account the caller owns as a PDF' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const receipt = await this.receiptQueryService.getByTransactionId(user.userId, transactionId);
    const content = receipt.content as never;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.referenceNumber}.pdf"`);

    const doc = this.receiptPdfService.render(content);
    doc.pipe(res);
    doc.end();
  }
}
