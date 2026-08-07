import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'REGIONAL_MANAGER' })
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'name must be SCREAMING_SNAKE_CASE' })
  name!: string;

  @ApiPropertyOptional({ example: 'Regional oversight across a cluster of branches' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Role this one inherits permissions from' })
  @IsOptional()
  @IsUUID()
  parentRoleId?: string;

  @ApiPropertyOptional({ description: 'Assigning this role will require maker-checker approval', default: false })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}
