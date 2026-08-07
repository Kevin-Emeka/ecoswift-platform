import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const ACCOUNT = API_URLS.account;

export type TransferLimitScope = 'GLOBAL' | 'TIER' | 'CUSTOMER' | 'ACCOUNT';

export interface TransferLimit {
  id: string;
  scope: TransferLimitScope;
  tier?: string;
  customerId?: string;
  customerName?: string;
  accountId?: string;
  accountNumber?: string;
  currencyCode: string;
  dailyLimit: string;
  perTransactionLimit: string;
  monthlyLimit: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CreateTransferLimitInput {
  scope: TransferLimitScope;
  tier?: string;
  customerId?: string;
  accountId?: string;
  currencyCode: string;
  dailyLimit: number;
  perTransactionLimit: number;
  monthlyLimit: number;
}

export function listTransferLimits(accessToken: string) {
  return apiRequest<TransferLimit[]>(ACCOUNT, '/v1/transfer-limits', { accessToken });
}

export function createTransferLimit(accessToken: string, input: CreateTransferLimitInput) {
  return apiRequest<TransferLimit>(ACCOUNT, '/v1/transfer-limits', { method: 'POST', accessToken, body: input });
}

export function retireTransferLimit(accessToken: string, id: string) {
  return apiRequest<void>(ACCOUNT, `/v1/transfer-limits/${id}`, { method: 'DELETE', accessToken });
}
