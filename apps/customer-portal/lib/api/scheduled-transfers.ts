import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface ScheduledTransfer {
  id: string;
  sourceAccountId: string;
  transferType: 'INTERNAL' | 'EXTERNAL';
  destinationAccountId?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  amount: string;
  currencyCode: string;
  description?: string;
  frequency: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  nextRunAt: string;
  endDate?: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  lastRunAt?: string;
  failureReason?: string;
  createdAt: string;
}

export interface CreateScheduledTransferInput {
  transferType: 'INTERNAL' | 'EXTERNAL';
  destinationAccountId?: string;
  beneficiaryId?: string;
  amount: number;
  description?: string;
  frequency: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  startAt: string;
  endDate?: string;
}

const ACCOUNT = API_URLS.account;

export function listScheduledTransfers(accessToken: string) {
  return apiRequest<ScheduledTransfer[]>(ACCOUNT, '/v1/scheduled-transfers', { accessToken });
}

export function createScheduledTransfer(accessToken: string, sourceAccountId: string, input: CreateScheduledTransferInput) {
  return apiRequest<ScheduledTransfer>(ACCOUNT, `/v1/accounts/${sourceAccountId}/scheduled-transfers`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export function cancelScheduledTransfer(accessToken: string, scheduledTransferId: string) {
  return apiRequest<void>(ACCOUNT, `/v1/scheduled-transfers/${scheduledTransferId}`, { method: 'DELETE', accessToken });
}
