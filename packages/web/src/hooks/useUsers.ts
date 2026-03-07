import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { User, PaginatedResponse } from '@supportdesk/shared';

export interface UserFilters {
  role?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

function buildQueryString(filters: UserFilters): string {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useUsers(filters: UserFilters = {}) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', filters],
    queryFn: () =>
      api.get<PaginatedResponse<User>>(
        `${ENDPOINTS.users.list}${buildQueryString(filters)}`,
      ),
  });
}

export interface InviteUserPayload {
  email: string;
  full_name: string;
  role: 'admin' | 'agent';
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation<User, Error, InviteUserPayload>({
    mutationFn: (payload) => api.post<User>(ENDPOINTS.users.invite, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export interface UpdateUserPayload {
  is_active?: boolean;
  role?: string;
  full_name?: string;
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<User, Error, UpdateUserPayload>({
    mutationFn: (payload) =>
      api.patch<User>(ENDPOINTS.users.detail(userId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
