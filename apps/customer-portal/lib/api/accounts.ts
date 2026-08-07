import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  accountTypeCode: string;
  currencyCode: string;
  status: string;
  availableBalance: string;
  currentBalance: string;
  openedAt: string;
  closedAt?: string;
  openingJournalNumber?: string;
}

export interface OpenAccountInput {
  accountTypeCode: 'CURRENT' | 'SAVINGS' | 'FIXED_DEPOSIT' | 'BUSINESS';
  currencyCode: string;
  // No openingBalance here — self-service accounts always open at $0 (only
  // staff-assisted opening, once built, should be able to fund at open
  // time). The backend rejects this field outright if sent anyway
  // (services/account-service's OpenAccountDto no longer declares it and
  // its ValidationPipe runs with forbidNonWhitelisted:true).
}

export interface Transaction {
  id: string;
  transactionReference: string;
  transactionType: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount: string;
  currencyCode: string;
  status: string;
  description?: string;
  sandbox: boolean;
  createdAt: string;
  completedAt?: string;
}

const ACCOUNT = API_URLS.account;

export function listMyAccounts(accessToken: string) {
  return apiRequest<Account[]>(ACCOUNT, '/v1/accounts', { accessToken });
}

export function getAccount(accessToken: string, accountId: string) {
  return apiRequest<Account>(ACCOUNT, `/v1/accounts/${accountId}`, { accessToken });
}

export function openAccount(accessToken: string, input: OpenAccountInput) {
  return apiRequest<Account>(ACCOUNT, '/v1/accounts', { method: 'POST', accessToken, body: input });
}

export function activateAccount(accessToken: string, accountId: string) {
  return apiRequest<{ id: string; status: string }>(ACCOUNT, `/v1/accounts/${accountId}/activate`, { method: 'POST', accessToken, body: {} });
}

export function freezeAccount(accessToken: string, accountId: string, reason?: string) {
  return apiRequest<{ id: string; status: string }>(ACCOUNT, `/v1/accounts/${accountId}/freeze`, { method: 'POST', accessToken, body: { reason } });
}

export function listAccountTransactions(accessToken: string, accountId: string) {
  return apiRequest<Transaction[]>(ACCOUNT, `/v1/accounts/${accountId}/transactions`, { accessToken });
}

export function depositToAccount(accessToken: string, accountId: string, amount: number, description?: string) {
  return apiRequest<Transaction>(ACCOUNT, `/v1/accounts/${accountId}/transactions/deposit`, {
    method: 'POST',
    accessToken,
    body: { amount, description },
  });
}

export function withdrawFromAccount(accessToken: string, accountId: string, amount: number, description?: string) {
  return apiRequest<Transaction>(ACCOUNT, `/v1/accounts/${accountId}/transactions/withdraw`, {
    method: 'POST',
    accessToken,
    body: { amount, description },
  });
}

export interface Transfer {
  id: string;
  transactionReference: string;
  transferType: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount: string;
  currencyCode: string;
  status: string;
  description?: string;
  sandbox: boolean;
  createdAt: string;
  completedAt?: string;
}

export function transferInternal(
  accessToken: string,
  sourceAccountId: string,
  destinationAccountId: string,
  amount: number,
  description?: string,
  mfaCode?: string,
) {
  return apiRequest<Transfer>(ACCOUNT, `/v1/accounts/${sourceAccountId}/transfers/internal`, {
    method: 'POST',
    accessToken,
    body: { destinationAccountId, amount, description, mfaCode },
  });
}

export interface WireTransferInput {
  beneficiaryName: string;
  accountNumber: string;
  bankName: string;
  swiftBic: string;
  bankAddress: string;
  bankCountryCode: string;
  routingNumber?: string;
  currencyCode: string;
  amount: number;
  description?: string;
  mfaCode?: string;
}

/** International wire transfer — full recipient/bank detail inline, no pre-saved beneficiary required. */
export function transferExternal(accessToken: string, sourceAccountId: string, input: WireTransferInput) {
  return apiRequest<Transfer>(ACCOUNT, `/v1/accounts/${sourceAccountId}/transfers/external`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}
