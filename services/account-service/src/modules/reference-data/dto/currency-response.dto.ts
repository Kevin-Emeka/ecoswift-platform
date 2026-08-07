import { ApiProperty } from '@nestjs/swagger';

export class CurrencyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  isoCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  symbol!: string;
}
