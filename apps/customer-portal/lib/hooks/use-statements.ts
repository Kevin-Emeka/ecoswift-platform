'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as statementsApi from '../api/statements';

export function useStatements() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['statements'],
    queryFn: () => statementsApi.listStatements(accessToken!),
    enabled: !!accessToken,
    // Statement generation is async (QUEUED -> RUNNING -> COMPLETED) — poll
    // briefly so a freshly-requested statement flips to downloadable
    // without the customer having to manually refresh.
    refetchInterval: (query) => (query.state.data?.some((s) => s.status === 'QUEUED' || s.status === 'RUNNING') ? 2000 : false),
  });
}

export function useRequestStatement() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, input }: { accountId: string; input: statementsApi.RequestStatementInput }) =>
      statementsApi.requestStatement(accessToken!, accountId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statements'] }),
  });
}
