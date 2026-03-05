import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as agentGroupService from '../services/agent-group.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/**
 * Zod schema for creating an agent group.
 */
const createAgentGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).nullable().optional(),
});

/**
 * Zod schema for updating an agent group.
 */
const updateAgentGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

/**
 * Zod schema for adding a member to an agent group.
 */
const addMemberSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
});

/**
 * Register agent group management routes.
 * All routes require authentication and admin or agent role.
 */
export async function agentGroupRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/agent-groups
   * List all agent groups for the current tenant.
   * Available to admins and agents.
   */
  app.get(
    '/agent-groups',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const result = await agentGroupService.listAgentGroups(request.tenantId!);
      return reply.status(200).send(result);
    },
  );

  /**
   * GET /v1/agent-groups/:id
   * Get a single agent group with full member list.
   * Available to admins and agents.
   */
  app.get(
    '/agent-groups/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const group = await agentGroupService.getAgentGroup(request.tenantId!, id);
      return reply.status(200).send(group);
    },
  );

  /**
   * POST /v1/agent-groups
   * Create a new agent group. Admin only.
   */
  app.post(
    '/agent-groups',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = createAgentGroupSchema.parse(request.body);
      const group = await agentGroupService.createAgentGroup(request.tenantId!, body);
      return reply.status(201).send(group);
    },
  );

  /**
   * PATCH /v1/agent-groups/:id
   * Update an agent group. Admin only.
   */
  app.patch(
    '/agent-groups/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateAgentGroupSchema.parse(request.body);
      const group = await agentGroupService.updateAgentGroup(request.tenantId!, id, body);
      return reply.status(200).send(group);
    },
  );

  /**
   * DELETE /v1/agent-groups/:id
   * Delete an agent group. Admin only.
   */
  app.delete(
    '/agent-groups/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await agentGroupService.deleteAgentGroup(request.tenantId!, id);
      return reply.status(204).send();
    },
  );

  /**
   * POST /v1/agent-groups/:id/members
   * Add a member to an agent group. Admin only.
   * The user must be an agent or admin within the same tenant.
   */
  app.post(
    '/agent-groups/:id/members',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = addMemberSchema.parse(request.body);
      const group = await agentGroupService.addMember(request.tenantId!, id, body);
      return reply.status(200).send(group);
    },
  );

  /**
   * DELETE /v1/agent-groups/:id/members/:userId
   * Remove a member from an agent group. Admin only.
   */
  app.delete(
    '/agent-groups/:id/members/:userId',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const group = await agentGroupService.removeMember(request.tenantId!, id, userId);
      return reply.status(200).send(group);
    },
  );
}
