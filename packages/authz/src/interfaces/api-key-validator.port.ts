export const API_KEY_VALIDATOR = Symbol('API_KEY_VALIDATOR');

export interface ValidatedApiKey {
  id: string;
  scopes: string[];
  ownerUserId?: string;
}

/** Validates a raw API key presented on a request (`X-API-Key` header) — never the key itself, only its hash ever touches storage or this interface. */
export interface ApiKeyValidatorPort {
  validate(rawKey: string): Promise<ValidatedApiKey | undefined>;
}
