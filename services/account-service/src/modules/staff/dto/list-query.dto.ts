import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Matches customer number, first name, last name, or email (case-insensitive, partial)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'DEACTIVATED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'DEACTIVATED'])
  status?: string;
}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Matches account number (partial)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;

  @ApiPropertyOptional({ enum: ['PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED', 'RESTRICTED'] })
  @IsOptional()
  @IsIn(['PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED', 'RESTRICTED'])
  status?: string;
}
