import { Body, Controller, Get, Param, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser, type AuthenticatedUser } from '@ecoswift/auth-client';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { StatementsService } from '../services/statements.service';
import { StatementRendererService } from '../services/statement-renderer.service';
import { RequestStatementDto, StatementRequestResponseDto } from '../dto/statement.dto';

@ApiTags('accounts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'accounts/:accountId/statements', version: '1' })
export class AccountStatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Post()
  @RequirePermissions('statements:generate')
  @ApiOperation({ summary: 'Request a statement for a caller-owned account over a date range' })
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: RequestStatementDto,
  ): Promise<StatementRequestResponseDto> {
    return this.statementsService.request(user.userId, accountId, dto);
  }
}

@ApiTags('statements')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'statements', version: '1' })
export class StatementsQueryController {
  constructor(
    private readonly statementsService: StatementsService,
    private readonly rendererService: StatementRendererService,
  ) {}

  @Get()
  @RequirePermissions('statements:read')
  @ApiOperation({ summary: "List the caller's statement requests across all accounts, newest first" })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<StatementRequestResponseDto[]> {
    return this.statementsService.list(user.userId);
  }

  @Get(':statementId/download')
  @RequirePermissions('statements:read')
  @ApiOperation({ summary: 'Download a completed statement as PDF or CSV' })
  async download(@CurrentUser() user: AuthenticatedUser, @Param('statementId') statementId: string, @Res() res: Response): Promise<void> {
    const statement = await this.statementsService.loadOwnedStatementForDownload(user.userId, statementId);
    const lines = await this.rendererService.loadLines(statement.accountId, statement.periodStart, statement.periodEnd);

    if (statement.format === 'CSV') {
      const csv = this.rendererService.renderCsv(lines);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="statement-${statement.account.accountNumber}.csv"`);
      res.send(csv);
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${statement.account.accountNumber}.pdf"`);
    const doc = this.rendererService.renderPdf({
      accountNumber: statement.account.accountNumber,
      currencyCode: statement.account.currency.isoCode,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      lines,
    });
    doc.pipe(res);
    doc.end();
  }
}
