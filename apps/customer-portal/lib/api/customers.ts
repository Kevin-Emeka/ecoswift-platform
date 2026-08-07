import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface CustomerProfile {
  customerId: string;
  customerNumber: string;
  tier: string;
  status: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  addressCountryCode?: string;
  occupation?: string;
  preferredLanguage: string;
  preferredCurrencyCode?: string;
  timezone: string;
  profileCompletionStatus: 'INCOMPLETE' | 'COMPLETE';
  missingFields: string[];
}

export interface UpdateProfileInput {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  addressCountryCode?: string;
  occupation?: string;
  preferredLanguage?: string;
  preferredCurrencyId?: string;
  timezone?: string;
  gender?: string;
}

export interface ConsentStatus {
  consentType: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY' | 'MARKETING_COMMUNICATIONS';
  version: string;
  accepted: boolean;
  acceptedAt: string;
}

const ACCOUNT = API_URLS.account;

export function getMyProfile(accessToken: string) {
  return apiRequest<CustomerProfile>(ACCOUNT, '/v1/customers/me', { accessToken });
}

export function updateMyProfile(accessToken: string, input: UpdateProfileInput) {
  return apiRequest<CustomerProfile>(ACCOUNT, '/v1/customers/me', { method: 'PATCH', accessToken, body: input });
}

export function getMyConsents(accessToken: string) {
  return apiRequest<ConsentStatus[]>(ACCOUNT, '/v1/customers/me/consents', { accessToken });
}

export function recordConsent(accessToken: string, consentType: ConsentStatus['consentType'], version: string, accepted: boolean) {
  return apiRequest<ConsentStatus>(ACCOUNT, '/v1/customers/me/consents', {
    method: 'POST',
    accessToken,
    body: { consentType, version, accepted },
  });
}
