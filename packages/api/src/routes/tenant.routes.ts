import type { FastifyInstance } from 'fastify';
import { updateTenantSchema } from '@supportdesk/shared';
import * as tenantService from '../services/tenant.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/**
 * Register tenant configuration routes.
 */
export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/tenant
   * Get the current tenant configuration.
   * Available to all authenticated users within the tenant.
   */
  app.get(
    '/tenant',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const tenant = await tenantService.getTenant(request.tenantId!);
      return reply.status(200).send(tenant);
    },
  );

  /**
   * PATCH /v1/tenant
   * Update the current tenant configuration.
   * Admin only.
   *
   * Accepts:
   *   - name: company name
   *   - brand_color: hex color string (#RRGGBB)
   *   - business_hours_start: HH:MM format
   *   - business_hours_end: HH:MM format
   *   - business_hours_timezone: IANA timezone string
   *   - business_hours_days: comma-separated day numbers (0=Sun, 6=Sat)
   *   - team_lead_email: email or null
   */
  app.patch(
    '/tenant',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = updateTenantSchema.parse(request.body);
      const tenant = await tenantService.updateTenant(request.tenantId!, body);
      return reply.status(200).send(tenant);
    },
  );

  /**
   * GET /v1/portal-config
   * Get public portal configuration (branding) by subdomain.
   * This endpoint is public (no auth required) for the client portal.
   */
  app.get(
    '/portal-config',
    async (request, reply) => {
      const { subdomain } = request.query as { subdomain?: string };

      if (!subdomain || typeof subdomain !== 'string') {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'subdomain query parameter is required',
            request_id: request.id as string,
          },
        });
      }

      const config = await tenantService.getPortalConfig(subdomain);
      return reply.status(200).send(config);
    },
  );
}
