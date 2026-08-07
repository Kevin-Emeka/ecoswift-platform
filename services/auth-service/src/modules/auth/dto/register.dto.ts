import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsPhoneNumber, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+15551234567', description: 'E.164 format' })
  @IsOptional()
  @IsPhoneNumber(undefined)
  phone?: string;

  @ApiProperty({ example: 'Str0ng!Passw0rd', minLength: 12 })
  @IsString()
  @MinLength(8) // structural minimum only — real policy enforced by PasswordService against Configuration
  password!: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @Matches(/^[\p{L} '-]+$/u, { message: 'firstName may only contain letters, spaces, apostrophes, and hyphens' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Marie' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @Matches(/^[\p{L} '-]+$/u, { message: 'lastName may only contain letters, spaces, apostrophes, and hyphens' })
  lastName!: string;

  @ApiProperty({ example: '1990-05-14' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: '3f9a1b2c-...', description: 'Country id (see the seeded Country catalog, prisma/seed.ts)' })
  @IsUUID()
  countryId!: string;
}
