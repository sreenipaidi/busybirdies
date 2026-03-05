import type { FastifyInstance } from 'fastify';
import { updateSLAPolicySchema } from '@supportdesk/shared';
import * as slaService from '../services/sla.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/**
 * Register all SLA-policy-related routes under the /sla-policies prefix.
 */
export async function slaPolicyRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/sla-policies
   * List all SLA policies for the tenant (one per priority level).
   * Admin only.
   */
  app.get(
    '/sla-policies',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const policies = await slaService.getPolicies(request.tenantId!);
      return reply.status(200).send({ data: policies });
    },
  );

  /**
   * PATCH /v1/sla-policies/:id
   * Update an SLA policy's response and resolution times.
   * Admin only.
   */
  app.patch(
    '/sla-policies/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateSLAPolicySchema.parse(request.body);
      const policy = await slaService.updatePolicy(request.tenantId!, id, body);
      return reply.status(200).send(policy);
    },
  );
}
