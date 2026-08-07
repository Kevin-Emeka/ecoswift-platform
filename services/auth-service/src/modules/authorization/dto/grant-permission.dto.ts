import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { PERMISSION_RESOURCES } from '@ecoswift/authz';

export class GrantPermissionDto {
  @ApiProperty({ enum: PERMISSION_RESOURCES, example: 'accounts' })
  @IsIn(PERMISSION_RESOURCES)
  resource!: string;

  @ApiProperty({ example: 'freeze' })
  @IsString()
  action!: string;
}
