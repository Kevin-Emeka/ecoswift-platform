import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CustomerStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: CustomerStatusDto })
  @IsEnum(CustomerStatusDto)
  status!: CustomerStatusDto;

  @ApiPropertyOptional({ example: 'Customer requested account closure' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
