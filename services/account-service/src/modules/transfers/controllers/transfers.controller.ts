import { Body, Controller, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { InternalTransferService } from '../services/internal-transfer.service';
import { ExternalTransferService } from '../services/external-transfer.service';
import { InternalTransferDto } from '../dto/internal-transfer.dto';
import { ExternalTransferDto } from '../dto/external-transfer.dto';
import { TransferResponseDto } from '../dto/transfer-response.dto';

/**
 * Nested under `/v1/accounts/:accountId/transfers`, matching
 * `TransactionsController`'s convention — every transfer is always
 * scoped to a caller-owned source account. Transfer history is not
 * duplicated here: it already surfaces through
 * `GET /v1/accounts/:accountId/transactions` (`TransactionQueryService`
 * queries by source/destination account regardless of transaction type).
 */
@ApiTags('accounts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'accounts/:accountId/transfers', version: '1' })
export class TransfersController {
  constructor(
    private readonly internalTransferService: InternalTransferService,
    private readonly externalTransferService: ExternalTransferService,
  ) {}

  @Post('internal')
  @RequirePermissions('transactions:create')
  @ApiOperation({ summary: "Transfer between two accounts the caller owns (e.g. Checking -> Savings)" })
  async internal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: InternalTransferDto,
  ): Promise<TransferResponseDto> {
    return this.internalTransferService.transfer(
      user.userId,
      accountId,
      dto.destinationAccountId,
      dto.amount,
      dto.description,
      dto.mfaCode,
      user.deviceId,
    );
  }

  @Post('external')
  @RequirePermissions('transactions:create')
  @ApiOperation({
    summary:
      'International wire transfer — full recipient/bank detail is captured inline, no pre-saved beneficiary required (simulated settlement only, see ExternalTransferService)',
  })
  async external(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: ExternalTransferDto,
  ): Promise<TransferResponseDto> {
    return this.externalTransferService.transfer(
      user.userId,
      accountId,
      {
        beneficiaryName: dto.beneficiaryName,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName,
        swiftBic: dto.swiftBic,
        bankAddress: dto.bankAddress,
        bankCountryCode: dto.bankCountryCode,
        routingNumber: dto.routingNumber,
        currencyCode: dto.currencyCode,
      },
      dto.amount,
      dto.description,
      dto.mfaCode,
      user.deviceId,
    );
  }
}
