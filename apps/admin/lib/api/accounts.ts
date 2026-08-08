import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const ACCOUNT = API_URLS.account;

export interface AccountActionResult {
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

export interface AccountStatusActionInput {
  reason?: string;
}

function statusAction(action: string) {
  return (accessToken: string, accountId: string, input: AccountStatusActionInput = {}) =>
    apiRequest<AccountActionResult>(ACCOUNT, `/v1/accounts/${accountId}/${action}`, {
      method: 'POST',
      accessToken,
      body: input,
    });
}

export const activateAccount = statusAction('activate');
export const freezeAccount = statusAction('freeze');
export const unfreezeAccount = statusAction('unfreeze');
export const closeAccount = statusAction('close');
export const restrictAccount = statusAction('restrict');
export const unrestrictAccount = statusAction('unrestrict');
export const markAccountDormant = statusAction('mark-dormant');
