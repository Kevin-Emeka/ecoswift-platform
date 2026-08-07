import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Also set as an httpOnly secure cookie — see docs/security-overview.md § Secure Cookies.' })
  refreshToken!: string;

  @ApiProperty()
  accessTokenExpiresInSeconds!: number;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  sessionId!: string;
}
