import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MessageResponseDto } from '../../auth/dto/message-response.dto';
import { MfaService } from '../services/mfa.service';
import { ConfirmCodeDto } from '../dto/confirm-code.dto';
import { RequireStepUp, StepUpGuard } from '../guards/step-up.guard';

enum ContactMfaMethod {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

/**
 * MFA factor management — enrollment, confirmation, and disable. Login-time
 * challenge/verify lives on `AuthController` instead (`/v1/auth/mfa/...`)
 * since it's part of the login flow, not account-settings management —
 * see docs/mfa.md § Where Things Live.
 */
@ApiTags('mfa')
@ApiBearerAuth('access-token')
@Controller({ path: 'mfa', version: '1' })
@UseGuards(StepUpGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('factors')
  @ApiOperation({ summary: 'List enrolled MFA factors' })
  async listFactors(@CurrentUser() user: AuthenticatedUser) {
    return this.mfaService.getEnrolledFactors(user.userId);
  }

  @Post('totp/enroll')
  @ApiOperation({ summary: 'Begin TOTP enrollment — returns a secret + otpauth:// URI for a QR code, shown once' })
  async enrollTotp(@CurrentUser() user: AuthenticatedUser) {
    return this.mfaService.enrollTotp(user.userId, user.email);
  }

  @Post('totp/confirm')
  @ApiOperation({ summary: 'Confirm TOTP enrollment with a code from the authenticator app — enables it and issues backup codes' })
  async confirmTotp(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmCodeDto) {
    return this.mfaService.confirmTotp(user.userId, dto.code);
  }

  @Post(':method/enroll')
  @ApiOperation({ summary: 'Begin SMS/EMAIL MFA enrollment — sends a confirmation code' })
  async enrollContactFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('method', new ParseEnumPipe(ContactMfaMethod)) method: ContactMfaMethod,
  ): Promise<MessageResponseDto> {
    return this.mfaService.enrollContactFactor(user.userId, method);
  }

  @Post(':method/confirm')
  @ApiOperation({ summary: 'Confirm SMS/EMAIL MFA enrollment' })
  async confirmContactFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('method', new ParseEnumPipe(ContactMfaMethod)) method: ContactMfaMethod,
    @Body() dto: ConfirmCodeDto,
  ): Promise<MessageResponseDto> {
    return this.mfaService.confirmContactFactor(user.userId, method, dto.code);
  }

  @Delete(':method')
  @RequireStepUp()
  @ApiOperation({ summary: 'Disable an MFA factor — requires a fresh step-up verification' })
  async disableFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('method', new ParseEnumPipe({ TOTP: 'TOTP', SMS: 'SMS', EMAIL: 'EMAIL' })) method: 'TOTP' | 'SMS' | 'EMAIL',
  ): Promise<MessageResponseDto> {
    await this.mfaService.disableFactor(user.userId, method);
    return { message: `${method} sign-in verification disabled.` };
  }

  @Post('backup-codes/regenerate')
  @RequireStepUp()
  @ApiOperation({ summary: 'Invalidate existing backup codes and issue a new set — requires a fresh step-up verification' })
  async regenerateBackupCodes(@CurrentUser() user: AuthenticatedUser) {
    const backupCodes = await this.mfaService.regenerateBackupCodes(user.userId);
    return { backupCodes };
  }
}
