import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../constants/index.js';

export const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().min(1, 'Description is required').max(10000),
  priority: z.enum(TICKET_PRIORITIES).optional().default('medium'),
  client_id: z.string().uuid().optional(),
  assigned_agent_id: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const createReplySchema = z.object({
  body: z.string().min(1, 'Reply body is required').max(50000),
  is_internal: z.boolean().optional().default(false),
});

export const ticketListQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigned_agent_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'priority']).optional().default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const heartbeatSchema = z.object({
  is_composing: z.boolean().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateReplyInput = z.infer<typeof createReplySchema>;
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
