import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const ACCOUNT = API_URLS.account;

export type TransferReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FraudSignal {
  signalType: string;
  score: number;
  reason?: string;
}

export interface TransferReviewItem {
  id: string;
  transactionReference: string;
  transferChannel: string;
  amount: string;
  currencyCode: string;
  sourceAccountNumber: string;
  destinationLabel: string;
  customerName: string;
  customerEmail: string;
  description?: string;
  approvalStatus: TransferReviewStatus;
  checkerName?: string;
  comments?: string;
  heldAt: string;
  resolvedAt?: string;
}

export interface TransferReviewDetail extends TransferReviewItem {
  fraudSignals: FraudSignal[];
}

export function listTransferReviews(accessToken: string, status: TransferReviewStatus = 'PENDING') {
  return apiRequest<TransferReviewItem[]>(ACCOUNT, `/v1/transfer-reviews?status=${status}`, { accessToken });
}

export function getTransferReview(accessToken: string, transactionId: string) {
  return apiRequest<TransferReviewDetail>(ACCOUNT, `/v1/transfer-reviews/${transactionId}`, { accessToken });
}

export function approveTransferReview(accessToken: string, transactionId: string, comments?: string) {
  return apiRequest<TransferReviewDetail>(ACCOUNT, `/v1/transfer-reviews/${transactionId}/approve`, {
    method: 'POST',
    accessToken,
    body: { comments },
  });
}

export function rejectTransferReview(accessToken: string, transactionId: string, reason: string) {
  return apiRequest<TransferReviewDetail>(ACCOUNT, `/v1/transfer-reviews/${transactionId}/reject`, {
    method: 'POST',
    accessToken,
    body: { reason },
  });
}
