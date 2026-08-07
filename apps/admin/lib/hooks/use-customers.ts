'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as staffApi from '../api/staff';

export function useCustomers(params: staffApi.ListCustomersParams, enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => staffApi.listCustomers(accessToken!, params),
    enabled: !!accessToken && enabled,
  });
}

export function useCustomer(customerId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['customers', customerId],
    queryFn: () => staffApi.getCustomer(accessToken!, customerId),
    enabled: !!accessToken && !!customerId,
  });
}
