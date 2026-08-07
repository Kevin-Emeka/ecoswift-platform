'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as auditApi from '../api/audit';

export function useAuditLogs(params: auditApi.ListAuditLogsParams, enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditApi.listAuditLogs(accessToken!, params),
    enabled: !!accessToken && enabled,
  });
}

export function useVerifyAuditChain() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: () => auditApi.verifyAuditChain(accessToken!),
  });
}
