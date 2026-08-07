import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class SandboxDepositDto {
  @ApiProperty({ example: 100, description: 'Sandbox-only — no real funds move. Must be > 0.' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Test deposit for demo' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class SandboxWithdrawalDto {
  @ApiProperty({ example: 50, description: 'Sandbox-only — no real funds move. Must be > 0 and not exceed the available balance unless the account type allows overdraft.' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Test withdrawal for demo' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
