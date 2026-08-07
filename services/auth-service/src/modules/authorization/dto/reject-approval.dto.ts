import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectApprovalDto {
  @ApiPropertyOptional({ example: 'Requested scope exceeds this role\'s normal duties' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
