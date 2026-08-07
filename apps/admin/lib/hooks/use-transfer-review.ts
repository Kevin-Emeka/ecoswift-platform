'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as transferReviewApi from '../api/transfer-review';

export function useTransferReviews(status: transferReviewApi.TransferReviewStatus) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['transfer-reviews', status],
    queryFn: () => transferReviewApi.listTransferReviews(accessToken!, status),
    enabled: !!accessToken,
  });
}

export function useTransferReview(transactionId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['transfer-reviews', 'detail', transactionId],
    queryFn: () => transferReviewApi.getTransferReview(accessToken!, transactionId),
    enabled: !!accessToken && !!transactionId,
  });
}

export function useApproveTransferReview(transactionId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (comments?: string) => transferReviewApi.approveTransferReview(accessToken!, transactionId, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-reviews'] });
    },
  });
}

export function useRejectTransferReview(transactionId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => transferReviewApi.rejectTransferReview(accessToken!, transactionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-reviews'] });
    },
  });
}
