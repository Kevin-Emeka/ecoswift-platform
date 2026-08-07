import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface Beneficiary {
  id: string;
  beneficiaryName: string;
  accountNumber: string;
  bankName?: string;
  bankCode?: string;
  currencyCode: string;
  nickname?: string;
  isFavorite: boolean;
  status: string;
  createdAt: string;
}

export interface CreateBeneficiaryInput {
  beneficiaryName: string;
  accountNumber: string;
  bankName?: string;
  bankCode?: string;
  currencyCode: string;
  nickname?: string;
}

const ACCOUNT = API_URLS.account;

export function listBeneficiaries(accessToken: string, search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<Beneficiary[]>(ACCOUNT, `/v1/beneficiaries${query}`, { accessToken });
}

export function createBeneficiary(accessToken: string, input: CreateBeneficiaryInput) {
  return apiRequest<Beneficiary>(ACCOUNT, '/v1/beneficiaries', { method: 'POST', accessToken, body: input });
}

export function updateBeneficiary(accessToken: string, beneficiaryId: string, input: { nickname?: string; isFavorite?: boolean }) {
  return apiRequest<Beneficiary>(ACCOUNT, `/v1/beneficiaries/${beneficiaryId}`, { method: 'PATCH', accessToken, body: input });
}

export function verifyBeneficiary(accessToken: string, beneficiaryId: string) {
  return apiRequest<Beneficiary>(ACCOUNT, `/v1/beneficiaries/${beneficiaryId}/verify`, { method: 'POST', accessToken, body: {} });
}

export function deleteBeneficiary(accessToken: string, beneficiaryId: string) {
  return apiRequest<void>(ACCOUNT, `/v1/beneficiaries/${beneficiaryId}`, { method: 'DELETE', accessToken });
}
