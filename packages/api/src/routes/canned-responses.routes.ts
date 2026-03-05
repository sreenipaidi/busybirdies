import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createCannedResponseSchema,
  updateCannedResponseSchema,
} from '@supportdesk/shared';
import * as cannedResponseService from '../services/canned-response.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/** Schema for canned response list query parameters. */
const cannedResponseQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(25),
});

/**
 * Register all canned-response-related routes under the /canned-responses prefix.
 */
export async function cannedResponseRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/canned-responses
   * List canned responses for the tenant with optional filtering.
   * Admin and Agent only.
   */
  app.get(
    '/canned-responses',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const query = cannedResponseQuerySchema.parse(request.query);
      const result = await cannedResponseService.listCannedResponses(
        request.tenantId!,
        query,
      );
      return reply.status(200).send(result);
    },
  );

  /**
   * POST /v1/canned-responses
   * Create a new canned response.
   * Admin and Agent only.
   */
  app.post(
    '/canned-responses',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const body = createCannedResponseSchema.parse(request.body);
      const user = request.user!;
      const response = await cannedResponseService.createCannedResponse(
        request.tenantId!,
        body,
        user.id,
      );
      return reply.status(201).send(response);
    },
  );

  /**
   * PATCH /v1/canned-responses/:id
   * Update a canned response.
   * Admin can update any; Agent can only update their own.
   */
  app.patch(
    '/canned-responses/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateCannedResponseSchema.parse(request.body);
      const user = request.user!;
      const response = await cannedResponseService.updateCannedResponse(
        request.tenantId!,
        id,
        body,
        { id: user.id, role: user.role },
      );
      return reply.status(200).send(response);
    },
  );

  /**
   * DELETE /v1/canned-responses/:id
   * Delete a canned response.
   * Admin can delete any; Agent can only delete their own.
   */
  app.delete(
    '/canned-responses/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      await cannedResponseService.deleteCannedResponse(
        request.tenantId!,
        id,
        { id: user.id, role: user.role },
      );
      return reply.status(204).send();
    },
  );
}
