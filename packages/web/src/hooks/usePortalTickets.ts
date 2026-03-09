import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type {
  Ticket,
  TicketListItem,
  TicketReply,
  PaginatedResponse,
} from '@busybirdies/shared';

/**
 * Filter parameters for the portal (client) ticket list.
 * The server automatically scopes results to the authenticated client.
 */
export interface PortalTicketFilters {
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

function buildQueryString(filters: PortalTicketFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_order) params.set('sort_order', filters.sort_order);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Fetch the client's own tickets (server auto-scopes by auth). */
export function usePortalTickets(filters: PortalTicketFilters = {}) {
  return useQuery<PaginatedResponse<TicketListItem>>({
    queryKey: ['portal-tickets', filters],
    queryFn: () =>
      api.get<PaginatedResponse<TicketListItem>>(
        `${ENDPOINTS.tickets.list}${buildQueryString(filters)}`,
      ),
  });
}

/** Portal stats derived from status-filtered ticket queries. */
export function usePortalStats() {
  const { data: openData } = usePortalTickets({ status: 'open', per_page: 1 });
  const { data: pendingData } = usePortalTickets({ status: 'pending', per_page: 1 });
  const { data: resolvedData } = usePortalTickets({ status: 'resolved', per_page: 1 });

  return {
    open: openData?.pagination.total ?? 0,
    pending: pendingData?.pagination.total ?? 0,
    resolved: resolvedData?.pagination.total ?? 0,
    isLoading: !openData || !pendingData || !resolvedData,
  };
}

/** Fetch full ticket detail for the portal (client view). */
interface PortalTicketDetailResponse {
  ticket: Ticket;
  replies: TicketReply[];
}

export function usePortalTicketDetail(id: string) {
  return useQuery<PortalTicketDetailResponse>({
    queryKey: ['portal-ticket', id],
    queryFn: () =>
      api.get<PortalTicketDetailResponse>(ENDPOINTS.tickets.detail(id)),
    enabled: !!id,
  });
}

/** Create a reply on a client ticket. */
export function usePortalCreateReply(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation<TicketReply, Error, { body: string }>({
    mutationFn: (payload) =>
      api.post<TicketReply>(ENDPOINTS.tickets.replies(ticketId), {
        body: payload.body,
        is_internal: false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal-ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
    },
  });
}

/** Create a ticket from the client portal. */
export interface PortalCreateTicketPayload {
  subject: string;
  description: string;
  priority: string;
}

export function usePortalCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation<Ticket, Error, PortalCreateTicketPayload>({
    mutationFn: (payload) =>
      api.post<Ticket>(ENDPOINTS.tickets.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
    },
  });
}
