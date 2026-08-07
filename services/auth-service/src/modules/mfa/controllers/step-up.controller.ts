import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { StepUpService } from '../services/step-up.service';
import { StepUpDto } from '../dto/step-up.dto';
import { STEP_UP_HEADER } from '../guards/step-up.guard';

/**
 * Step-up Authentication for an already-signed-in session — re-verify an
 * MFA factor to unlock a sensitive action without a full sign-out/in
 * cycle. The returned token is presented on the follow-up request as the
 * `X-Step-Up-Token` header (`StepUpGuard`/`@RequireStepUp()`).
 */
@ApiTags('mfa')
@ApiBearerAuth('access-token')
@Controller({ path: 'auth/step-up', version: '1' })
export class StepUpController {
  constructor(private readonly stepUpService: StepUpService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  @ApiOperation({ summary: `Re-verify an MFA factor; returns a short-lived token to present as ${STEP_UP_HEADER}` })
  async stepUp(@CurrentUser() user: AuthenticatedUser, @Body() dto: StepUpDto): Promise<{ stepUpToken: string }> {
    const stepUpToken = await this.stepUpService.completeStepUp(user.userId, user.sessionId, dto.method, dto.code);
    return { stepUpToken };
  }
}
