'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as beneficiariesApi from '../api/beneficiaries';

export function useBeneficiaries(search?: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['beneficiaries', search ?? ''],
    queryFn: () => beneficiariesApi.listBeneficiaries(accessToken!, search),
    enabled: !!accessToken,
  });
}

export function useCreateBeneficiary() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: beneficiariesApi.CreateBeneficiaryInput) => beneficiariesApi.createBeneficiary(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });
}

export function useUpdateBeneficiary() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ beneficiaryId, input }: { beneficiaryId: string; input: { nickname?: string; isFavorite?: boolean } }) =>
      beneficiariesApi.updateBeneficiary(accessToken!, beneficiaryId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });
}

export function useVerifyBeneficiary() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beneficiaryId: string) => beneficiariesApi.verifyBeneficiary(accessToken!, beneficiaryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });
}

export function useDeleteBeneficiary() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beneficiaryId: string) => beneficiariesApi.deleteBeneficiary(accessToken!, beneficiaryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });
}
