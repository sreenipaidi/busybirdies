import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { CannedResponse, PaginatedResponse } from '@busybirdies/shared';

/** Filters for listing canned responses. */
interface CannedResponseFilters {
  category?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

/**
 * Hook that fetches canned responses with optional filtering.
 *
 * @param filters - Optional filters for category, search, and pagination
 * @returns TanStack Query result with paginated canned responses
 */
export function useCannedResponses(filters: CannedResponseFilters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.category) {
    queryParams.set('category', filters.category);
  }
  if (filters.search) {
    queryParams.set('search', filters.search);
  }
  if (filters.page) {
    queryParams.set('page', String(filters.page));
  }
  if (filters.per_page) {
    queryParams.set('per_page', String(filters.per_page));
  }

  const queryString = queryParams.toString();
  const url = queryString
    ? `${ENDPOINTS.cannedResponses.list}?${queryString}`
    : ENDPOINTS.cannedResponses.list;

  return useQuery<PaginatedResponse<CannedResponse>>({
    queryKey: ['cannedResponses', filters],
    queryFn: () => api.get<PaginatedResponse<CannedResponse>>(url),
  });
}

/** Payload for creating a canned response. */
interface CreateCannedResponsePayload {
  title: string;
  body: string;
  category?: string;
}

/**
 * Hook that provides a mutation for creating a new canned response.
 *
 * @returns TanStack Query mutation for creating canned responses
 */
export function useCreateCannedResponse() {
  const queryClient = useQueryClient();

  return useMutation<CannedResponse, Error, CreateCannedResponsePayload>({
    mutationFn: (payload) =>
      api.post<CannedResponse>(ENDPOINTS.cannedResponses.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cannedResponses'] });
    },
  });
}
