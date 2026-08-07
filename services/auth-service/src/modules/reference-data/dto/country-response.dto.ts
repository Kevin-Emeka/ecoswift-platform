import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  isoCode!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  dialingCode?: string;
}
