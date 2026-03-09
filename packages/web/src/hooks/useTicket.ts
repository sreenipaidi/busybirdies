import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type {
  Ticket,
  TicketReply,
  AuditEntry,
} from '@busybirdies/shared';

interface TicketDetailResponse {
  ticket: Ticket;
  replies: TicketReply[];
  audit_trail: AuditEntry[];
}

export function useTicket(id: string) {
  return useQuery<TicketDetailResponse>({
    queryKey: ['ticket', id],
    queryFn: () => api.get<TicketDetailResponse>(ENDPOINTS.tickets.detail(id)),
    enabled: !!id,
  });
}

export interface UpdateTicketPayload {
  status?: string;
  priority?: string;
  assigned_agent_id?: string | null;
  tags?: string[];
}

export function useUpdateTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Ticket, Error, UpdateTicketPayload>({
    mutationFn: (payload) =>
      api.patch<Ticket>(ENDPOINTS.tickets.detail(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
