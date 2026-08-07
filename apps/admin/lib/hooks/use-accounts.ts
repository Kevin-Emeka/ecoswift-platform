'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as staffApi from '../api/staff';
import * as accountsApi from '../api/accounts';

export function useStaffAccounts(params: staffApi.ListAccountsParams, enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['staff-accounts', params],
    queryFn: () => staffApi.listStaffAccounts(accessToken!, params),
    enabled: !!accessToken && enabled,
  });
}

export function useStaffAccount(accountId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['staff-accounts', accountId],
    queryFn: () => staffApi.getStaffAccount(accessToken!, accountId),
    enabled: !!accessToken && !!accountId,
  });
}

function useAccountStatusMutation(fn: typeof accountsApi.unfreezeAccount, accountId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: accountsApi.AccountStatusActionInput) => fn(accessToken!, accountId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-accounts', accountId] });
    },
  });
}

export function useFreezeAccount(accountId: string) {
  return useAccountStatusMutation(accountsApi.freezeAccount, accountId);
}

export function useUnfreezeAccount(accountId: string) {
  return useAccountStatusMutation(accountsApi.unfreezeAccount, accountId);
}

export function useCloseAccount(accountId: string) {
  return useAccountStatusMutation(accountsApi.closeAccount, accountId);
}

export function useRestrictAccount(accountId: string) {
  return useAccountStatusMutation(accountsApi.restrictAccount, accountId);
}

export function useUnrestrictAccount(accountId: string) {
  return useAccountStatusMutation(accountsApi.unrestrictAccount, accountId);
}

export function useMarkAccountDormant(accountId: string) {
  return useAccountStatusMutation(accountsApi.markAccountDormant, accountId);
}

export function useCreditAccount(accountId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: staffApi.AdminCreditInput) => staffApi.creditAccount(accessToken!, accountId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-accounts', accountId] });
    },
  });
}
