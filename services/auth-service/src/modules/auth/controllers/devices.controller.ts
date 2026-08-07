import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import { DeviceService } from '../services/device.service';
import { DeviceResponseDto } from '../dto/device-response.dto';
import { MessageResponseDto } from '../dto/message-response.dto';
import { RevokeDeviceDto } from '../dto/revoke-device.dto';

@ApiTags('devices')
@ApiBearerAuth('access-token')
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @ApiOperation({ summary: 'List devices that have signed in to your account' })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<DeviceResponseDto[]> {
    const devices = await this.deviceService.listForUser(user.userId);
    return devices.map((device) => ({
      id: device.id,
      deviceName: device.deviceName ?? undefined,
      platform: device.platform ?? undefined,
      trustLevel: device.trustLevel,
      lastSeenAt: device.lastSeenAt,
      trustedAt: device.trustedAt ?? undefined,
      lastIpAddress: device.lastIpAddress ?? undefined,
      riskScore: device.riskScore ? Number(device.riskScore) : undefined,
      revokedAt: device.revokedAt ?? undefined,
      revokedReason: device.revokedReason ?? undefined,
    }));
  }

  @Post(':id/trust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a device as trusted' })
  async trust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) deviceId: string,
  ): Promise<MessageResponseDto> {
    await this.deviceService.trust(user.userId, deviceId);
    return { message: 'Device trusted.' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forget a device (removes it from your device list)' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) deviceId: string,
  ): Promise<MessageResponseDto> {
    await this.deviceService.remove(user.userId, deviceId);
    return { message: 'Device removed.' };
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a device — ends every active session on it immediately, for a device you no longer trust' })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) deviceId: string,
    @Body() dto: RevokeDeviceDto,
  ): Promise<MessageResponseDto> {
    await this.deviceService.revoke(user.userId, deviceId, dto.reason ?? 'USER_REVOKED');
    return { message: 'Device revoked — all sessions on it have been ended.' };
  }
}
