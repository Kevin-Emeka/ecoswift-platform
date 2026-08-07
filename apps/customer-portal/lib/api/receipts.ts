import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface ReceiptContent {
  receiptReference: string;
  transactionReference: string;
  transactionType: string;
  status: string;
  amount: string;
  currencyCode: string;
  sourceAccountNumber?: string;
  destinationAccountNumber?: string;
  senderName?: string;
  recipientName?: string;
  description?: string;
  sandbox: boolean;
  transactionCreatedAt: string;
}

export interface Receipt {
  id: string;
  referenceNumber: string;
  format: string;
  content: ReceiptContent;
  generatedAt: string;
}

export function getReceiptForTransaction(accessToken: string, transactionId: string) {
  return apiRequest<Receipt>(API_URLS.receipt, `/v1/receipts/transaction/${transactionId}`, { accessToken });
}

export function listReceipts(accessToken: string) {
  return apiRequest<Receipt[]>(API_URLS.receipt, '/v1/receipts', { accessToken });
}

export function getReceiptDownloadUrl(transactionId: string) {
  return `${API_URLS.receipt}/v1/receipts/transaction/${transactionId}/download`;
}
