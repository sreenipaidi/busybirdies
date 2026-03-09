import type { FastifyInstance } from 'fastify';
import {
  createAssignmentRuleSchema,
  updateAssignmentRuleSchema,
  reorderRulesSchema,
} from '@busybirdies/shared';
import * as assignmentService from '../services/assignment.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/**
 * Register all assignment-rule-related routes under the /assignment-rules prefix.
 */
export async function assignmentRuleRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/assignment-rules
   * List all assignment rules for the tenant, ordered by priority_order.
   * Admin only.
   */
  app.get(
    '/assignment-rules',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const rules = await assignmentService.listRules(request.tenantId!);
      return reply.status(200).send({ data: rules });
    },
  );

  /**
   * POST /v1/assignment-rules
   * Create a new assignment rule. Automatically placed at the end of the priority order.
   * Admin only.
   */
  app.post(
    '/assignment-rules',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = createAssignmentRuleSchema.parse(request.body);
      const rule = await assignmentService.createRule(request.tenantId!, body);
      return reply.status(201).send(rule);
    },
  );

  /**
   * PATCH /v1/assignment-rules/:id
   * Update an existing assignment rule.
   * Admin only.
   */
  app.patch(
    '/assignment-rules/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateAssignmentRuleSchema.parse(request.body);
      const rule = await assignmentService.updateRule(request.tenantId!, id, body);
      return reply.status(200).send(rule);
    },
  );

  /**
   * DELETE /v1/assignment-rules/:id
   * Delete an assignment rule.
   * Admin only.
   */
  app.delete(
    '/assignment-rules/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assignmentService.deleteRule(request.tenantId!, id);
      return reply.status(204).send();
    },
  );

  /**
   * PUT /v1/assignment-rules/reorder
   * Reorder all assignment rules by providing the complete ordered list of IDs.
   * Admin only.
   */
  app.put(
    '/assignment-rules/reorder',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = reorderRulesSchema.parse(request.body);
      const rules = await assignmentService.reorderRules(request.tenantId!, body);
      return reply.status(200).send({ data: rules });
    },
  );
}
