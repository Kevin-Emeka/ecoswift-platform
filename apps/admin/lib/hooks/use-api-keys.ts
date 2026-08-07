'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as apiKeysApi from '../api/api-keys';

export function useApiKeys() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.listApiKeys(accessToken!),
    enabled: !!accessToken,
  });
}

export function useCreateApiKey() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: apiKeysApi.CreateApiKeyInput) => apiKeysApi.createApiKey(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeysApi.revokeApiKey(accessToken!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}
