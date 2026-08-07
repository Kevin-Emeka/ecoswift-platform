import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { BeneficiariesService } from '../services/beneficiaries.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto, BeneficiaryResponseDto } from '../dto/beneficiary.dto';

@ApiTags('beneficiaries')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'beneficiaries', version: '1' })
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Get()
  @RequirePermissions('beneficiaries:read')
  @ApiOperation({ summary: 'List the caller\'s saved beneficiaries, favorites first' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string): Promise<BeneficiaryResponseDto[]> {
    return this.beneficiariesService.list(user.userId, search);
  }

  @Post()
  @RequirePermissions('beneficiaries:create')
  @ApiOperation({ summary: 'Save a new beneficiary' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBeneficiaryDto): Promise<BeneficiaryResponseDto> {
    return this.beneficiariesService.create(user.userId, dto);
  }

  @Patch(':beneficiaryId')
  @RequirePermissions('beneficiaries:update')
  @ApiOperation({ summary: 'Rename or favorite/unfavorite a beneficiary' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('beneficiaryId') beneficiaryId: string,
    @Body() dto: UpdateBeneficiaryDto,
  ): Promise<BeneficiaryResponseDto> {
    return this.beneficiariesService.update(user.userId, beneficiaryId, dto);
  }

  @Post(':beneficiaryId/verify')
  @RequirePermissions('beneficiaries:update')
  @ApiOperation({ summary: 'Confirm a beneficiary — simplified in-app verification, not real bank-account ownership verification' })
  async verify(@CurrentUser() user: AuthenticatedUser, @Param('beneficiaryId') beneficiaryId: string): Promise<BeneficiaryResponseDto> {
    return this.beneficiariesService.verify(user.userId, beneficiaryId);
  }

  @Delete(':beneficiaryId')
  @HttpCode(204)
  @RequirePermissions('beneficiaries:delete')
  @ApiOperation({ summary: 'Remove a beneficiary' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('beneficiaryId') beneficiaryId: string): Promise<void> {
    await this.beneficiariesService.delete(user.userId, beneficiaryId);
  }
}
