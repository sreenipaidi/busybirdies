import type { TicketPriority } from '../constants/ticket-priority.js';

export interface SLAPolicy {
  id: string;
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
  updated_at: string;
}
