import { ApiProperty } from '@nestjs/swagger';

export class ReceiptResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  referenceNumber!: string;

  @ApiProperty({ enum: ['PDF', 'CSV', 'JSON'] })
  format!: string;

  @ApiProperty({ description: 'Self-contained snapshot of the transaction at the moment the receipt was generated' })
  content!: Record<string, unknown>;

  @ApiProperty()
  generatedAt!: string;
}
