import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class AdminCreditDto {
  @ApiProperty({ example: 250, description: 'Amount to credit — must be greater than 0' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    example: 'Opening-balance funding requested by customer via support ticket #4521',
    description: 'Required — recorded on the transaction and the audit log. This is real money movement on the ledger; always justify it.',
  })
  @IsString()
  @MinLength(5)
  reason!: string;
}
