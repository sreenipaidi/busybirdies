import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationError, AuthorizationError } from '../lib/errors.js';
import type { UserRole } from '@busybirdies/shared';

/**
 * Factory function that returns a Fastify preHandler hook enforcing role-based access.
 * The hook checks that the authenticated user's role is in the list of allowed roles.
 * Returns 401 if the user is not authenticated, or 403 if the role is not allowed.
 *
 * @param allowedRoles - One or more roles that are permitted to access the route
 * @returns A Fastify preHandler hook function
 */
export function requireRole(
  ...allowedRoles: UserRole[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }
  };
}
