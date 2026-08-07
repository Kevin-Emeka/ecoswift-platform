'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as sessionsApi from '../api/sessions';

export function useUserSessions(userId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['sessions', userId],
    queryFn: () => sessionsApi.listSessionsForUser(accessToken!, userId),
    enabled: !!accessToken && !!userId,
    retry: false,
  });
}
