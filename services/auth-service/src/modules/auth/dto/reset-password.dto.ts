import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the password reset link' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'N3w!Str0ngPassw0rd', minLength: 12 })
  @IsString()
  @MinLength(8) // structural minimum only — real policy enforced by PasswordService against Configuration
  newPassword!: string;
}
