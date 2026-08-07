'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as scheduledTransfersApi from '../api/scheduled-transfers';

export function useScheduledTransfers() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['scheduled-transfers'],
    queryFn: () => scheduledTransfersApi.listScheduledTransfers(accessToken!),
    enabled: !!accessToken,
  });
}

export function useCreateScheduledTransfer() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceAccountId, input }: { sourceAccountId: string; input: scheduledTransfersApi.CreateScheduledTransferInput }) =>
      scheduledTransfersApi.createScheduledTransfer(accessToken!, sourceAccountId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-transfers'] }),
  });
}

export function useCancelScheduledTransfer() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduledTransferId: string) => scheduledTransfersApi.cancelScheduledTransfer(accessToken!, scheduledTransferId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-transfers'] }),
  });
}
