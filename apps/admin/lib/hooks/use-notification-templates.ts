'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as notificationsApi from '../api/notifications';

export function useNotificationTemplates() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => notificationsApi.listNotificationTemplates(accessToken!),
    enabled: !!accessToken,
  });
}
