import { apiRequest } from './http-client';
import { API_URLS } from '../config';
import type { PaginatedResult } from '@ecoswift/types';

const ACCOUNT = API_URLS.account;

export interface CustomerSummary {
  customerId: string;
  customerNumber: string;
  fullName: string;
  email: string;
  status: string;
  tier: string;
  accountCount: number;
  dateJoined: string;
}

export interface AccountSummary {
  id: string;
  accountNumber: string;
  customerId: string;
  customerNumber: string;
  accountTypeCode: string;
  currencyCode: string;
  status: string;
  availableBalance: string;
  openedAt: string;
}

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
  profileCompletionStatus: string;
  missingFields: string[];
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface ListAccountsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listCustomers(accessToken: string, params: ListCustomersParams = {}) {
  return apiRequest<PaginatedResult<CustomerSummary>>(ACCOUNT, `/v1/staff/customers${toQuery({ ...params })}`, { accessToken });
}

export function getCustomer(accessToken: string, customerId: string) {
  return apiRequest<CustomerProfile>(ACCOUNT, `/v1/staff/customers/${customerId}`, { accessToken });
}

export function listStaffAccounts(accessToken: string, params: ListAccountsParams = {}) {
  return apiRequest<PaginatedResult<AccountSummary>>(ACCOUNT, `/v1/staff/accounts${toQuery({ ...params })}`, { accessToken });
}

export function getStaffAccount(accessToken: string, accountId: string) {
  return apiRequest<AccountSummary>(ACCOUNT, `/v1/staff/accounts/${accountId}`, { accessToken });
}

export interface AdminCreditInput {
  amount: number;
  reason: string;
}

export interface AdminCreditResult {
  id: string;
  transactionReference: string;
  transactionType: string;
  amount: string;
  currencyCode: string;
  status: string;
  description?: string;
  sandbox: boolean;
  createdAt: string;
  completedAt?: string;
}

/** Staff-assisted funding of an existing account — sandbox-only, requires `accounts:credit`. See docs on `OpenAccountDto` for why self-service can't do this itself. */
export function creditAccount(accessToken: string, accountId: string, input: AdminCreditInput) {
  return apiRequest<AdminCreditResult>(ACCOUNT, `/v1/staff/accounts/${accountId}/credit`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}
