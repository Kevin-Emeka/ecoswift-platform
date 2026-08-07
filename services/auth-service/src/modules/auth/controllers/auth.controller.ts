import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CsrfService, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@ecoswift/security';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RequestPhoneVerificationDto } from '../dto/request-phone-verification.dto';
import { VerifyPhoneDto } from '../dto/verify-phone.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { MfaChallengeResponseDto } from '../dto/mfa-challenge-response.dto';
import { MessageResponseDto } from '../dto/message-response.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/auth-cookie.util';
import { extractRequestContext } from '../utils/request-context.util';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
  ) {}

  @Public()
  @Throttle({ strict: { limit: 30, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  async register(@Body() dto: RegisterDto): Promise<MessageResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email address from the link sent at registration' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-email-verification')
  @ApiOperation({ summary: 'Resend the email verification link' })
  async resendEmailVerification(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resendEmailVerification(dto.email);
  }

  @Public()
  @Throttle({ strict: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto | MfaChallengeResponseDto> {
    const result = await this.authService.login(dto, extractRequestContext(req));
    if ('mfaRequired' in result) {
      return result; // no session/tokens exist yet — nothing to cookie until /v1/auth/mfa/verify completes it
    }
    setRefreshTokenCookie(res, result.refreshToken, new Date(Date.now() + result.accessTokenExpiresInSeconds * 1000));
    this.csrfService.issueToken(res, process.env.NODE_ENV === 'production');
    return result;
  }

  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Sign out of the current session' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logout(user.sessionId);
    clearRefreshTokenCookie(res);
    this.csrfService.clearToken(res);
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair (rotates the refresh token)' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
    const refreshToken = dto.refreshToken ?? cookieToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    // CSRF Protection (Phase 3C § API Security) — only relevant when the
    // request is relying on **ambient cookie authority** (no explicit
    // token in the body, which is what a browser client using the
    // httpOnly cookie looks like). A caller that supplies `refreshToken`
    // in the body directly (mobile apps, this service's own e2e tests)
    // isn't exploitable via CSRF in the first place — a forged cross-site
    // request can't know a token it was never given — so it isn't gated
    // by this check.
    if (!dto.refreshToken && cookieToken) {
      const csrfCookie = (req.cookies as Record<string, string | undefined> | undefined)?.[CSRF_COOKIE_NAME];
      const csrfHeader = req.headers[CSRF_HEADER_NAME];
      if (!csrfCookie || !csrfHeader || Array.isArray(csrfHeader) || csrfHeader !== csrfCookie) {
        throw new ForbiddenException('Missing or invalid CSRF token');
      }
    }

    const result = await this.authService.refresh(refreshToken, extractRequestContext(req));
    setRefreshTokenCookie(res, result.refreshToken, new Date(Date.now() + result.accessTokenExpiresInSeconds * 1000));
    return result;
  }

  @Public()
  @Throttle({ strict: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset a password using a reset link token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @ApiOperation({ summary: 'Change password while authenticated' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.changePassword(user.userId, dto, user.sessionId);
  }

  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Post('phone/request-verification')
  @ApiOperation({ summary: 'Send an SMS verification code to a phone number' })
  async requestPhoneVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestPhoneVerificationDto,
  ): Promise<MessageResponseDto> {
    return this.authService.requestPhoneVerification(user.userId, dto);
  }

  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Post('phone/verify')
  @ApiOperation({ summary: 'Confirm a phone number with its SMS verification code' })
  async verifyPhone(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyPhoneDto): Promise<MessageResponseDto> {
    return this.authService.verifyPhone(user.userId, dto.code);
  }

  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Post('deactivate')
  @ApiOperation({ summary: 'Deactivate your own account' })
  async deactivate(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    return this.authService.deactivateAccount(user.userId);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    return this.authService.getCurrentUser(user.userId);
  }
}
