import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  phoneVerified!: boolean;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'] })
  status!: string;

  @ApiPropertyOptional()
  customerNumber?: string;
}
