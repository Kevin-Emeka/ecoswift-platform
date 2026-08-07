import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface StatementRequest {
  id: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  format: 'PDF' | 'CSV';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  statementId?: string;
  completedAt?: string;
  createdAt: string;
}

export interface RequestStatementInput {
  periodStart: string;
  periodEnd: string;
  format: 'PDF' | 'CSV';
}

const RECEIPT = API_URLS.receipt;

export function requestStatement(accessToken: string, accountId: string, input: RequestStatementInput) {
  return apiRequest<StatementRequest>(RECEIPT, `/v1/accounts/${accountId}/statements`, { method: 'POST', accessToken, body: input });
}

export function listStatements(accessToken: string) {
  return apiRequest<StatementRequest[]>(RECEIPT, '/v1/statements', { accessToken });
}

export function getStatementDownloadUrl(statementId: string) {
  return `${RECEIPT}/v1/statements/${statementId}/download`;
}
