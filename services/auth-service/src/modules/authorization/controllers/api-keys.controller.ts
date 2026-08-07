import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MessageResponseDto } from '../../auth/dto/message-response.dto';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'api-keys', version: '1' })
@UseGuards(PermissionsGuard)
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @RequirePermissions('api_keys:read')
  @ApiOperation({ summary: 'List API keys (metadata only — the raw secret is never retrievable after creation)' })
  async list() {
    return this.apiKeyService.list();
  }

  @Post()
  @RequirePermissions('api_keys:create')
  @ApiOperation({ summary: 'Create an API key — the raw key is returned exactly once' })
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apiKeyService.create(
      { name: dto.name, scopes: dto.scopes, ownerUserId: dto.ownerUserId, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
      user.userId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('api_keys:revoke')
  @ApiOperation({ summary: 'Revoke an API key' })
  async revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.apiKeyService.revoke(id, user.userId);
    return { message: 'API key revoked.' };
  }
}
