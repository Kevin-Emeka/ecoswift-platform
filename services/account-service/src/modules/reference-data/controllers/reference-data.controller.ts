import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@ecoswift/database';
import { Public } from '../../../common/decorators/public.decorator';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import type { CurrencyResponseDto } from '../dto/currency-response.dto';

/** Public reference data forms need (currency pickers for profile/account-opening) — `@Public()`, no permission check. */
@ApiTags('reference-data')
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'currencies', version: '1' })
export class ReferenceDataController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active currencies' })
  async list(): Promise<CurrencyResponseDto[]> {
    const currencies = await this.prisma.currency.findMany({ where: { status: 'ACTIVE' }, orderBy: { isoCode: 'asc' } });
    return currencies.map((currency) => ({ id: currency.id, isoCode: currency.isoCode, name: currency.name, symbol: currency.symbol }));
  }
}
