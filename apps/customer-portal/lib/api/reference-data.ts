import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface Country {
  id: string;
  isoCode: string;
  name: string;
  dialingCode?: string;
}

export interface Currency {
  id: string;
  isoCode: string;
  name: string;
  symbol: string;
}

export function listCountries() {
  return apiRequest<Country[]>(API_URLS.auth, '/v1/countries');
}

export function listCurrencies() {
  return apiRequest<Currency[]>(API_URLS.account, '/v1/currencies');
}
