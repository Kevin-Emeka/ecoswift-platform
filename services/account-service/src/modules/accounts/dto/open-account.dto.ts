import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class OpenAccountDto {
  @ApiProperty({ enum: ['CURRENT', 'SAVINGS', 'FIXED_DEPOSIT', 'BUSINESS'], example: 'SAVINGS' })
  @IsIn(['CURRENT', 'SAVINGS', 'FIXED_DEPOSIT', 'BUSINESS'])
  accountTypeCode!: string;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code — must be an active seeded currency' })
  @IsString()
  currencyCode!: string;

  // No openingBalance field here on purpose: this DTO backs the self-service
  // `POST /accounts` endpoint (`AccountsController.openAccount`), and a
  // customer declaring their own starting balance would let them fabricate
  // funds. Self-service accounts always open at $0 — see
  // `AccountService.open()`. A staff-assisted opening flow that can
  // legitimately fund an account is out of scope for this phase (docs/
  // account-opening.md § What This Phase Did Not Build); that flow, when it
  // exists, should carry its own DTO with this field restricted to staff.
  // Because the global `ValidationPipe` runs with `forbidNonWhitelisted:
  // true` (services/account-service/src/main.ts), a request that still
  // sends `openingBalance` is rejected outright rather than silently
  // ignored.
}
