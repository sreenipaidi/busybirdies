import type { TicketPriority, TicketStatus, TicketSource } from '../constants/index.js';
import type { UserSummary } from './user.js';

export interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  client: UserSummary;
  created_by: UserSummary;
  assigned_agent: UserSummary | null;
  tags: string[];
  source: TicketSource;
  sla_first_response_due: string | null;
  sla_resolution_due: string | null;
  sla_first_response_met: boolean | null;
  sla_resolution_met: boolean | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketListItem {
  id: string;
  ticket_number: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  client: UserSummary;
  assigned_agent: UserSummary | null;
  tags: string[];
  sla_first_response_due: string | null;
  sla_first_response_met: boolean | null;
  created_at: string;
  updated_at: string;
}
