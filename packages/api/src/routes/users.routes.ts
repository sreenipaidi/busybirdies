import type { FastifyInstance } from 'fastify';
import {
  inviteUserSchema,
  activateUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from '@busybirdies/shared';
import * as userService from '../services/user.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/**
 * Register all user management routes under the /users prefix.
 */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/users
   * List users in the tenant. Admin only.
   * Supports filtering by role, is_active, and search.
   */
  app.get(
    '/users',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const query = userListQuerySchema.parse(request.query);
      const result = await userService.listUsers(request.tenantId!, query);

      return reply.status(200).send(result);
    },
  );

  /**
   * POST /v1/users/invite
   * Invite a new employee (agent or admin) to the tenant.
   * Admin only. Sends an activation email (stubbed).
   */
  app.post(
    '/users/invite',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = inviteUserSchema.parse(request.body);
      const user = await userService.inviteUser(request.tenantId!, body);

      return reply.status(201).send(user);
    },
  );

  /**
   * POST /v1/users/activate
   * Set password via activation link. Public endpoint.
   */
  app.post('/users/activate', async (request, reply) => {
    const body = activateUserSchema.parse(request.body);
    const result = await userService.activateUser(body);

    return reply.status(200).send(result);
  });

  /**
   * GET /v1/users/:id
   * Get a user by ID. Admin or the user themselves.
   */
  app.get(
    '/users/:id',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestingUser = request.user!;

      // Non-admins can only view their own profile
      if (requestingUser.role !== 'admin' && requestingUser.id !== id) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            request_id: request.id as string,
          },
        });
      }

      const user = await userService.getUser(request.tenantId!, id);

      return reply.status(200).send(user);
    },
  );

  /**
   * PATCH /v1/users/:id
   * Update a user. Admin can update all fields; users can update
   * their own name and password only.
   */
  app.patch(
    '/users/:id',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestingUser = request.user!;
      const body = updateUserSchema.parse(request.body);

      const updated = await userService.updateUser(
        request.tenantId!,
        id,
        body,
        requestingUser.id,
        requestingUser.role,
      );

      return reply.status(200).send(updated);
    },
  );
}
