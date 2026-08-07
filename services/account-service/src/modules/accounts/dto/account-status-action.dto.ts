import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared body shape for every status-transition endpoint (activate/freeze/unfreeze/close/restrict/unrestrict/mark-dormant/reactivate). */
export class AccountStatusActionDto {
  @ApiPropertyOptional({ example: 'Customer requested a temporary freeze' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
