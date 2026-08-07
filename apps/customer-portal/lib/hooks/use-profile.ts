'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as customersApi from '../api/customers';

export function useProfile() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => customersApi.getMyProfile(accessToken!),
    enabled: !!accessToken,
  });
}

export function useUpdateProfile() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: customersApi.UpdateProfileInput) => customersApi.updateMyProfile(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useConsents() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['consents'],
    queryFn: () => customersApi.getMyConsents(accessToken!),
    enabled: !!accessToken,
  });
}

export function useRecordConsent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consentType, version, accepted }: { consentType: customersApi.ConsentStatus['consentType']; version: string; accepted: boolean }) =>
      customersApi.recordConsent(accessToken!, consentType, version, accepted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consents'] }),
  });
}
