'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as featureFlagsApi from '../api/feature-flags';

export function useFeatureFlags() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsApi.listFeatureFlags(accessToken!),
    enabled: !!accessToken,
  });
}

export function useCreateFeatureFlag() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: featureFlagsApi.CreateFeatureFlagInput) => featureFlagsApi.createFeatureFlag(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}

export function useUpdateFeatureFlag(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: featureFlagsApi.UpdateFeatureFlagInput) => featureFlagsApi.updateFeatureFlag(accessToken!, id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}

export function useToggleFeatureFlag() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => featureFlagsApi.toggleFeatureFlag(accessToken!, id, isEnabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}
