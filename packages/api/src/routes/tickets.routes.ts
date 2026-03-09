import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createTicketSchema,
  updateTicketSchema,
  createReplySchema,
  ticketListQuerySchema,
} from '@busybirdies/shared';
import * as ticketService from '../services/ticket.service.js';
import * as replyService from '../services/reply.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/** Schema for the assign-ticket request body. */
const assignTicketSchema = z.object({
  agent_id: z.string().uuid('agent_id must be a valid UUID'),
});

/** Schema for pagination query params shared by replies and audit. */
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Register all ticket-related routes under the /tickets prefix.
 */
export async function ticketRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /v1/tickets
   * Create a new ticket. Agents/admins must specify client_id.
   * Clients create tickets for themselves.
   */
  app.post(
    '/tickets',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const body = createTicketSchema.parse(request.body);
      const user = request.user!;
      const ticket = await ticketService.createTicket(
        request.tenantId!,
        body,
        { id: user.id, role: user.role },
      );

      return reply.status(201).send(ticket);
    },
  );

  /**
   * GET /v1/tickets
   * List tickets with filters, sorting, and pagination.
   * Agents/admins see all tenant tickets; clients see only their own.
   */
  app.get(
    '/tickets',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const query = ticketListQuerySchema.parse(request.query);
      const user = request.user!;
      const result = await ticketService.listTickets(
        request.tenantId!,
        query,
        { id: user.id, role: user.role },
      );

      return reply.status(200).send(result);
    },
  );

  /**
   * GET /v1/tickets/:id
   * Get full ticket detail including replies and audit trail.
   * Clients can only view their own tickets and do not see audit trail.
   */
  app.get(
    '/tickets/:id',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const result = await ticketService.getTicket(
        request.tenantId!,
        id,
        { id: user.id, role: user.role },
      );

      return reply.status(200).send(result);
    },
  );

  /**
   * PATCH /v1/tickets/:id
   * Update ticket fields (status, priority, assigned_agent_id, tags).
   * Only agents and admins can update tickets.
   */
  app.patch(
    '/tickets/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateTicketSchema.parse(request.body);
      const user = request.user!;
      const ticket = await ticketService.updateTicket(
        request.tenantId!,
        id,
        body,
        { id: user.id, role: user.role },
      );

      return reply.status(200).send(ticket);
    },
  );

  /**
   * POST /v1/tickets/:id/replies
   * Add a reply or internal note to a ticket.
   * Clients can only add public replies. Agents/admins can add both.
   */
  app.post(
    '/tickets/:id/replies',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createReplySchema.parse(request.body);
      const user = request.user!;
      const replyResult = await replyService.addReply(
        request.tenantId!,
        id,
        body,
        user.id,
        user.role,
      );

      return reply.status(201).send(replyResult);
    },
  );

  /**
   * GET /v1/tickets/:id/replies
   * Get paginated replies for a ticket.
   * Clients only see public replies; agents/admins see all.
   */
  app.get(
    '/tickets/:id/replies',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { page, per_page } = paginationQuerySchema.parse(request.query);
      const user = request.user!;
      const result = await replyService.getReplies(
        request.tenantId!,
        id,
        user.role,
        user.id,
        page,
        per_page,
      );

      return reply.status(200).send(result);
    },
  );

  /**
   * GET /v1/tickets/:id/audit
   * Get paginated audit trail for a ticket.
   * Only agents and admins can access the audit trail.
   */
  app.get(
    '/tickets/:id/audit',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { page, per_page } = paginationQuerySchema.parse(request.query);
      const result = await ticketService.getAuditTrail(
        request.tenantId!,
        id,
        page,
        per_page,
      );

      return reply.status(200).send(result);
    },
  );

  /**
   * POST /v1/tickets/:id/assign
   * Assign a ticket to a specific agent.
   * Only agents and admins can assign tickets.
   */
  app.post(
    '/tickets/:id/assign',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = assignTicketSchema.parse(request.body);
      const user = request.user!;
      const ticket = await ticketService.assignTicket(
        request.tenantId!,
        id,
        body.agent_id,
        { id: user.id, role: user.role },
      );

      return reply.status(200).send(ticket);
    },
  );
}
