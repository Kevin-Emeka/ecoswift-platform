import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@ecoswift/database';
import { Public } from '../../../common/decorators/public.decorator';
import type { CountryResponseDto } from '../dto/country-response.dto';

/** Public reference data the registration form needs before a session exists — `@Public()`, same as `/v1/auth/register` itself. */
@ApiTags('reference-data')
@Controller({ path: 'countries', version: '1' })
export class ReferenceDataController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active countries (for registration forms)' })
  async list(): Promise<CountryResponseDto[]> {
    const countries = await this.prisma.country.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return countries.map((country) => ({
      id: country.id,
      isoCode: country.isoCode,
      name: country.name,
      dialingCode: country.dialingCode ?? undefined,
    }));
  }
}
