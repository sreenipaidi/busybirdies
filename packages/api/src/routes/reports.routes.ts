import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as reportService from '../services/report.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { AuthorizationError } from '../lib/errors.js';

/** Schema for dashboard query parameters. */
const dashboardQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

/** Schema for agent report query parameters. */
const agentReportQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

/**
 * Register all reporting-related routes under the /reports prefix.
 */
export async function reportRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/reports/dashboard
   * Aggregated dashboard metrics for the admin.
   * Returns ticket volume, response times, SLA compliance, agent stats, and CSAT data.
   */
  app.get(
    '/reports/dashboard',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const query = dashboardQuerySchema.parse(request.query);
      const dateRange = reportService.buildDateRange(query.date_from, query.date_to);
      const metrics = await reportService.getDashboardMetrics(
        request.tenantId!,
        dateRange,
      );

      return reply.status(200).send(metrics);
    },
  );

  /**
   * GET /v1/reports/team
   * Per-agent metrics for all agents in the tenant.
   */
  app.get(
    '/reports/team',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const query = dashboardQuerySchema.parse(request.query);
      const dateRange = reportService.buildDateRange(query.date_from, query.date_to);
      const metrics = await reportService.getTeamMetrics(request.tenantId!, dateRange);
      return reply.status(200).send(metrics);
    },
  );

  /**
   * GET /v1/reports/agent/:id
   * Per-agent performance metrics.
   * Admins can view any agent. Agents can only view their own metrics.
   */
  app.get(
    '/reports/agent/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      // Agents can only view their own metrics
      if (user.role === 'agent' && user.id !== id) {
        throw new AuthorizationError('Agents can only view their own metrics');
      }

      const query = agentReportQuerySchema.parse(request.query);
      const dateRange = reportService.buildDateRange(query.date_from, query.date_to);
      const metrics = await reportService.getAgentMetrics(
        request.tenantId!,
        id,
        dateRange,
      );

      return reply.status(200).send(metrics);
    },
  );
}
