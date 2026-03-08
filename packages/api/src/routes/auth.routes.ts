import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createTenantSchema,
} from '@supportdesk/shared';
import * as authService from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { getConfig } from '../config.js';

/**
 * Set the session cookie on the reply with httpOnly, Secure (in production),
 * and SameSite=Lax attributes.
 */
function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: string,
): void {
  const config = getConfig();
  const isProduction = config.NODE_ENV === 'production';

  reply.setCookie('session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

/**
 * Clear the session cookie from the reply.
 */
function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie('session', {
    path: '/',
  });
}

/**
 * Register all authentication-related routes under the /auth prefix.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /v1/auth/login
   * Authenticate a user by email/password within a given portal (tenant).
   * Returns user data and sets a JWT in an httpOnly cookie.
   */
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body);

    setSessionCookie(reply, result.token, result.expiresAt);

    return reply.status(200).send({
      user: result.user,
      tenant: result.tenant,
      expires_at: result.expiresAt,
    });
  });

  /**
   * POST /v1/auth/register
   * Client self-registration on a given portal.
   */
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body);

    return reply.status(201).send({
      message: result.message,
      user_id: result.userId,
    });
  });

  /**
   * POST /v1/auth/logout
   * Clear the session cookie.
   */
  app.post(
    '/auth/logout',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      clearSessionCookie(reply);

      return reply.status(200).send({
        message: 'Logged out successfully.',
      });
    },
  );

  /**
   * POST /v1/auth/forgot-password
   * Initiate password reset flow. Always returns the same response
   * to prevent user enumeration.
   */
  app.post('/auth/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    const result = await authService.forgotPassword(body);

    return reply.status(200).send(result);
  });

  /**
   * POST /v1/auth/reset-password
   * Reset password using a valid reset token.
   */
  app.post('/auth/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    const result = await authService.resetPassword(body);

    return reply.status(200).send(result);
  });

  /**
   * GET /v1/auth/me
   * Get the current authenticated user's profile and tenant info.
   */
  app.get(
    '/auth/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const result = await authService.getCurrentUser(user.id, user.tenantId);

      return reply.status(200).send(result);
    },
  );

  /**
   * POST /v1/tenants
   * Create a new tenant (signup flow). Sets the session cookie for the new admin.
   */
  app.post('/tenants', async (request, reply) => {
    const body = createTenantSchema.parse(request.body);
    const result = await authService.createTenant(body);

    setSessionCookie(reply, result.token, result.expiresAt);

    return reply.status(201).send({
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
        support_email: `support@${result.tenant.subdomain}.helpdesk.com`,
      },
      user: result.user,
      expires_at: result.expiresAt,
    });
  });
  // Verify email address via activation token
  app.get('/auth/verify-email', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) {
      return reply.status(400).send({ error: 'TOKEN_REQUIRED', message: 'Verification token is required.' });
    }
    const result = await authService.verifyEmail(token);
    return reply.send(result);
  });


}
