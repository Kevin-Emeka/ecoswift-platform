import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class CheckPermissionDto {
  @ApiProperty({ isArray: true, example: ['loans:approve'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissions!: string[];
}
