'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as notificationsApi from '../api/notifications';

export function useNotifications(page = 1) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['notifications', page],
    queryFn: () => notificationsApi.listMyNotifications(accessToken!, page),
    enabled: !!accessToken,
  });
}

export function useMarkNotificationRead() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markNotificationRead(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllNotificationsRead(accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
