'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { getUnreadCount } from '../api/notifications';

export function useUnreadCount() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadCount(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });
}
