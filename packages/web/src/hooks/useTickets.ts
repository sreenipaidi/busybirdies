import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type {
  TicketListItem,
  PaginatedResponse,
  Ticket,
} from '@busybirdies/shared';

export interface TicketFilters {
  status?: string;
  priority?: string;
  assigned_agent_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

function buildQueryString(filters: TicketFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assigned_agent_id) params.set('assigned_agent_id', filters.assigned_agent_id);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_order) params.set('sort_order', filters.sort_order);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useTickets(filters: TicketFilters = {}) {
  return useQuery<PaginatedResponse<TicketListItem>>({
    queryKey: ['tickets', filters],
    queryFn: () =>
      api.get<PaginatedResponse<TicketListItem>>(
        `${ENDPOINTS.tickets.list}${buildQueryString(filters)}`,
      ),
  });
}

export interface TicketStats {
  open: number;
  pending: number;
  resolved_today: number;
  sla_breaches: number;
}

export function useTicketStats() {
  const { data: openData } = useTickets({ status: 'open', per_page: 1 });
  const { data: pendingData } = useTickets({ status: 'pending', per_page: 1 });
  const { data: resolvedData } = useTickets({ status: 'resolved', per_page: 1 });

  return {
    open: openData?.pagination.total ?? 0,
    pending: pendingData?.pagination.total ?? 0,
    resolved_today: resolvedData?.pagination.total ?? 0,
    sla_breaches: 0,
  };
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  priority: string;
  client_id?: string;
  assigned_agent_id?: string;
  tags?: string[];
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation<Ticket, Error, CreateTicketPayload>({
    mutationFn: (payload) =>
      api.post<Ticket>(ENDPOINTS.tickets.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
