import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { SLAPolicy } from '@busybirdies/shared';

export function useSLAPolicies() {
  return useQuery<{ data: SLAPolicy[] }>({
    queryKey: ['sla-policies'],
    queryFn: () => api.get<{ data: SLAPolicy[] }>(ENDPOINTS.slaPolicies.list),
  });
}

export interface UpdateSLAPolicyPayload {
  first_response_minutes: number;
  resolution_minutes: number;
}

export function useUpdateSLAPolicy(id: string) {
  const queryClient = useQueryClient();
  return useMutation<SLAPolicy, Error, UpdateSLAPolicyPayload>({
    mutationFn: (payload) => api.patch<SLAPolicy>(ENDPOINTS.slaPolicies.detail(id), payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
  });
}
