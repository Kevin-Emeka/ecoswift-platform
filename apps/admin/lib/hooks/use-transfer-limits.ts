'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as transferLimitsApi from '../api/transfer-limits';

export function useTransferLimits() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['transfer-limits'],
    queryFn: () => transferLimitsApi.listTransferLimits(accessToken!),
    enabled: !!accessToken,
  });
}

export function useCreateTransferLimit() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: transferLimitsApi.CreateTransferLimitInput) => transferLimitsApi.createTransferLimit(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer-limits'] }),
  });
}

export function useRetireTransferLimit() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transferLimitsApi.retireTransferLimit(accessToken!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer-limits'] }),
  });
}
