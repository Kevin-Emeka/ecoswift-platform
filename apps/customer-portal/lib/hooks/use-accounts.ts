'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as accountsApi from '../api/accounts';

export function useAccounts() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.listMyAccounts(accessToken!),
    enabled: !!accessToken,
  });
}

export function useAccount(accountId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['accounts', accountId],
    queryFn: () => accountsApi.getAccount(accessToken!, accountId),
    enabled: !!accessToken && !!accountId,
  });
}

export function useAccountTransactions(accountId: string | undefined) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['accounts', accountId, 'transactions'],
    queryFn: () => accountsApi.listAccountTransactions(accessToken!, accountId!),
    enabled: !!accessToken && !!accountId,
  });
}

export function useOpenAccount() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: accountsApi.OpenAccountInput) => accountsApi.openAccount(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useActivateAccount() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => accountsApi.activateAccount(accessToken!, accountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useDeposit(accountId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description }: { amount: number; description?: string }) =>
      accountsApi.depositToAccount(accessToken!, accountId, amount, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'transactions'] });
    },
  });
}

export function useWithdraw(accountId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description }: { amount: number; description?: string }) =>
      accountsApi.withdrawFromAccount(accessToken!, accountId, amount, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'transactions'] });
    },
  });
}

export function useExternalTransfer() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceAccountId, ...input }: { sourceAccountId: string } & accountsApi.WireTransferInput) =>
      accountsApi.transferExternal(accessToken!, sourceAccountId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.sourceAccountId, 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
    },
  });
}

export function useInternalTransfer() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceAccountId,
      destinationAccountId,
      amount,
      description,
      mfaCode,
    }: {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      description?: string;
      mfaCode?: string;
    }) => accountsApi.transferInternal(accessToken!, sourceAccountId, destinationAccountId, amount, description, mfaCode),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.sourceAccountId, 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.destinationAccountId, 'transactions'] });
    },
  });
}
