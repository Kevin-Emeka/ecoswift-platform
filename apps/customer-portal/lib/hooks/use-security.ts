'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as authApi from '../api/auth';

export function useSessions() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.listSessions(accessToken!),
    enabled: !!accessToken,
  });
}

export function useRevokeSession() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(accessToken!, sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useDevices() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => authApi.listDevices(accessToken!),
    enabled: !!accessToken,
  });
}

export function useRevokeDevice() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => authApi.revokeDevice(accessToken!, deviceId, 'Revoked from Security settings'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });
}
