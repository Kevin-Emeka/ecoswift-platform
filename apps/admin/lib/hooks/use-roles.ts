'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import * as rolesApi from '../api/roles';
import * as permissionsApi from '../api/permissions';

export function useRoles() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.listRoles(accessToken!),
    enabled: !!accessToken,
  });
}

export function useRole(id: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => rolesApi.getRole(accessToken!, id),
    enabled: !!accessToken && !!id,
  });
}

export function useRoleAuditHistory(id: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['roles', id, 'audit-history'],
    queryFn: () => rolesApi.getRoleAuditHistory(accessToken!, id),
    enabled: !!accessToken && !!id,
  });
}

export function usePermissionsCatalog() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.listPermissions(accessToken!),
    enabled: !!accessToken,
  });
}

export function usePermissionGroups() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['permissions', 'groups'],
    queryFn: () => permissionsApi.listPermissionGroups(accessToken!),
    enabled: !!accessToken,
  });
}

export function useCreateRole() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: rolesApi.CreateRoleInput) => rolesApi.createRole(accessToken!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: rolesApi.UpdateRoleInput) => rolesApi.updateRole(accessToken!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', id] });
    },
  });
}

export function useDeleteRole() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(accessToken!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useGrantRolePermission(roleId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      rolesApi.grantRolePermission(accessToken!, roleId, resource, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', roleId] }),
  });
}

export function useRevokeRolePermission(roleId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      rolesApi.revokeRolePermission(accessToken!, roleId, resource, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', roleId] }),
  });
}
