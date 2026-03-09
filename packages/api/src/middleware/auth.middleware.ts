import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../lib/jwt.js';
import { AuthenticationError } from '../lib/errors.js';
import type { JwtPayload } from '../lib/jwt.js';
import type { UserRole } from '@busybirdies/shared';

/** Shape of the authenticated user context attached to every request. */
export interface RequestUser {
  id: string;
  tenantId: string;
  role: UserRole;
}

// Extend FastifyRequest to include user context
declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

const COOKIE_NAME = 'session';

/**
 * Fastify preHandler hook that verifies the JWT from the httpOnly session cookie.
 * On success, attaches the decoded user information to `request.user`.
 * On failure, responds with 401 Unauthorized.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[COOKIE_NAME];

  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }

  request.user = {
    id: payload.sub,
    tenantId: payload.tid,
    role: payload.role as UserRole,
  };
}
