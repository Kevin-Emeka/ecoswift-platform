'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as receiptsApi from '../api/receipts';

export function useReceipts() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['receipts'],
    queryFn: () => receiptsApi.listReceipts(accessToken!),
    enabled: !!accessToken,
  });
}
