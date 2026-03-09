import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type {
  TicketReply,
  PaginatedResponse,
} from '@busybirdies/shared';

export function useReplies(ticketId: string) {
  return useQuery<PaginatedResponse<TicketReply>>({
    queryKey: ['replies', ticketId],
    queryFn: () =>
      api.get<PaginatedResponse<TicketReply>>(
        `${ENDPOINTS.tickets.replies(ticketId)}?per_page=50`,
      ),
    enabled: !!ticketId,
  });
}

export interface CreateReplyPayload {
  body: string;
  is_internal: boolean;
}

export function useCreateReply(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation<TicketReply, Error, CreateReplyPayload>({
    mutationFn: (payload) =>
      api.post<TicketReply>(ENDPOINTS.tickets.replies(ticketId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['replies', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
