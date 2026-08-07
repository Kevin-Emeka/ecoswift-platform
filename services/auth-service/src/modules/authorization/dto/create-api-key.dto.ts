import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PERMISSION_CATALOG, permissionCode } from '@ecoswift/authz';

const VALID_SCOPES = PERMISSION_CATALOG.map((p) => permissionCode(p.resource, p.action));

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Reporting integration — read-only' })
  @IsString()
  @MaxLength(128)
  name!: string;

  @ApiProperty({ enum: VALID_SCOPES, isArray: true, example: ['reports:read', 'accounts:read'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_SCOPES, { each: true })
  scopes!: string[];

  @ApiPropertyOptional({ description: 'Staff user this key is issued on behalf of' })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
