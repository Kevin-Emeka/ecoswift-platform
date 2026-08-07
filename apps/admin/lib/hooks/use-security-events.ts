'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as securityEventsApi from '../api/security-events';

export function useSecurityEvents(params: securityEventsApi.ListSecurityEventsParams, enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['security-events', params],
    queryFn: () => securityEventsApi.listSecurityEvents(accessToken!, params),
    enabled: !!accessToken && enabled,
  });
}
