import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@ecoswift/database';
import { CsrfService } from '@ecoswift/security';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthService } from '../../auth/services/auth.service';
import { TokenService } from '../../auth/services/token.service';
import { AuthResponseDto } from '../../auth/dto/auth-response.dto';
import { MessageResponseDto } from '../../auth/dto/message-response.dto';
import { setRefreshTokenCookie } from '../../auth/utils/auth-cookie.util';
import { extractRequestContext } from '../../auth/utils/request-context.util';
import { MfaService } from '../services/mfa.service';
import { MfaLoginChallengeRequestDto, MfaLoginVerifyDto } from '../dto/mfa-login.dto';

/**
 * Completes a login that `AuthController.login()` paused for MFA — see
 * docs/mfa.md § Login Flow. Both routes are `@Public()`: the caller has no
 * real access token at this point, only the short-lived `mfaToken` from
 * the initial `/v1/auth/login` response, which each handler verifies
 * itself before doing anything else.
 */
@ApiTags('mfa')
@Controller({ path: 'auth/mfa', version: '1' })
export class MfaLoginController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
    private readonly csrfService: CsrfService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('challenge')
  @ApiOperation({ summary: 'Send an SMS/EMAIL MFA code mid-login (TOTP/backup codes need no send step)' })
  async challenge(@Body() dto: MfaLoginChallengeRequestDto): Promise<MessageResponseDto> {
    const payload = await this.verifyChallengeToken(dto.mfaToken);
    await this.mfaService.sendLoginChallenge(payload.sub, dto.method);
    return { message: `A verification code has been sent via ${dto.method === 'SMS' ? 'SMS' : 'email'}.` };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  @ApiOperation({ summary: 'Complete login by verifying an MFA factor' })
  async verify(
    @Body() dto: MfaLoginVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const payload = await this.verifyChallengeToken(dto.mfaToken);
    await this.mfaService.verifyFactor(payload.sub, dto.method, dto.code);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true, actorType: true },
    });
    const result = await this.authService.completeLogin(user, payload.rememberMe, extractRequestContext(req));

    setRefreshTokenCookie(res, result.refreshToken, new Date(Date.now() + result.accessTokenExpiresInSeconds * 1000));
    this.csrfService.issueToken(res, process.env.NODE_ENV === 'production');
    return result;
  }

  private async verifyChallengeToken(mfaToken: string) {
    try {
      return await this.tokenService.verifyMfaChallengeToken(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge — please sign in again');
    }
  }
}
