import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({ example: '482913', description: '6-digit SMS code' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
