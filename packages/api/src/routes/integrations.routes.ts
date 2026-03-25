import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { tenantIntegrations } from '../db/schema.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const slackConfigSchema = z.object({
  webhookUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  channel: z.string().optional(),
  notifyOnPriorities: z.array(z.enum(['urgent', 'high', 'medium', 'low'])).default(['urgent', 'high']),
  enabled: z.boolean().default(true),
});

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/integrations/slack
   * Get Slack integration config for the tenant.
   */
  app.get(
    '/integrations/slack',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const db = getDb();
      const [integration] = await db
        .select()
        .from(tenantIntegrations)
        .where(and(eq(tenantIntegrations.tenantId, request.tenantId!), eq(tenantIntegrations.type, 'slack')))
        .limit(1);

      if (!integration) {
        return reply.status(200).send({
          enabled: false,
          webhookUrl: '',
          channel: '',
          notifyOnPriorities: ['urgent', 'high'],
        });
      }

      const config = integration.config as Record<string, unknown>;
      return reply.status(200).send({
        enabled: integration.enabled,
        webhookUrl: config.webhookUrl ?? '',
        channel: config.channel ?? '',
        notifyOnPriorities: config.notifyOnPriorities ?? ['urgent', 'high'],
      });
    },
  );

  /**
   * PUT /v1/integrations/slack
   * Create or update Slack integration config.
   */
  app.put(
    '/integrations/slack',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = slackConfigSchema.parse(request.body);
      const db = getDb();

      const [existing] = await db
        .select({ id: tenantIntegrations.id })
        .from(tenantIntegrations)
        .where(and(eq(tenantIntegrations.tenantId, request.tenantId!), eq(tenantIntegrations.type, 'slack')))
        .limit(1);

      const config = {
        webhookUrl: body.webhookUrl,
        channel: body.channel ?? '',
        notifyOnPriorities: body.notifyOnPriorities,
      };

      if (existing) {
        await db
          .update(tenantIntegrations)
          .set({ config, enabled: body.enabled, updatedAt: new Date() })
          .where(eq(tenantIntegrations.id, existing.id));
      } else {
        await db.insert(tenantIntegrations).values({
          tenantId: request.tenantId!,
          type: 'slack',
          config,
          enabled: body.enabled,
        });
      }

      return reply.status(200).send({ ...config, enabled: body.enabled });
    },
  );

  /**
   * POST /v1/integrations/slack/test
   * Send a test Slack notification.
   */
  app.post(
    '/integrations/slack/test',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const db = getDb();
      const [integration] = await db
        .select()
        .from(tenantIntegrations)
        .where(and(eq(tenantIntegrations.tenantId, request.tenantId!), eq(tenantIntegrations.type, 'slack')))
        .limit(1);

      if (!integration) {
        return reply.status(400).send({ error: { code: 'NOT_CONFIGURED', message: 'Slack integration is not configured.' } });
      }

      const config = integration.config as { webhookUrl?: string; channel?: string };
      if (!config.webhookUrl) {
        return reply.status(400).send({ error: { code: 'NOT_CONFIGURED', message: 'Webhook URL is not set.' } });
      }

      const message = {
        text: '✅ Test notification from BusyBirdies! Your Slack integration is working correctly.',
        ...(config.channel ? { channel: config.channel } : {}),
      };

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        return reply.status(400).send({ error: { code: 'SLACK_ERROR', message: 'Slack returned an error. Check your webhook URL.' } });
      }

      return reply.status(200).send({ message: 'Test notification sent successfully.' });
    },
  );

  const jiraConfigSchema = z.object({
    baseUrl: z.string().url('Must be a valid URL').or(z.literal('')),
    email: z.string().email('Must be a valid email').or(z.literal('')),
    apiToken: z.string(),
    projectKey: z.string(),
    issueType: z.string().default('Task'),
    enabled: z.boolean().default(true),
  });

  app.get(
    '/integrations/jira',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const db = getDb();
      const [integration] = await db
        .select()
        .from(tenantIntegrations)
        .where(and(eq(tenantIntegrations.tenantId, request.tenantId!), eq(tenantIntegrations.type, 'jira')))
        .limit(1);

      if (!integration) {
        return reply.status(200).send({ enabled: false, baseUrl: '', email: '', apiToken: '', projectKey: '', issueType: 'Task' });
      }

      const config = integration.config as Record<string, unknown>;
      return reply.status(200).send({ enabled: integration.enabled, ...config });
    },
  );

  app.put(
    '/integrations/jira',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = jiraConfigSchema.parse(request.body);
      const db = getDb();

      const [existing] = await db
        .select({ id: tenantIntegrations.id })
        .from(tenantIntegrations)
        .where(and(eq(tenantIntegrations.tenantId, request.tenantId!), eq(tenantIntegrations.type, 'jira')))
        .limit(1);

      const config = { baseUrl: body.baseUrl, email: body.email, apiToken: body.apiToken, projectKey: body.projectKey, issueType: body.issueType };

      if (existing) {
        await db.update(tenantIntegrations).set({ config, enabled: body.enabled, updatedAt: new Date() }).where(eq(tenantIntegrations.id, existing.id));
      } else {
        await db.insert(tenantIntegrations).values({ tenantId: request.tenantId!, type: 'jira', config, enabled: body.enabled });
      }

      return reply.status(200).send({ ...config, enabled: body.enabled });
    },
  );

  app.post(
    '/integrations/jira/test',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { getJiraConfig, createJiraIssue } = await import('../services/jira.service.js');
      const config = await getJiraConfig(request.tenantId!);

      if (!config) {
        return reply.status(400).send({ error: { code: 'NOT_CONFIGURED', message: 'Jira integration is not configured.' } });
      }

      try {
        const issue = await createJiraIssue(config, {
          summary: '[TEST] BusyBirdies Jira integration test',
          description: 'This is a test issue created by BusyBirdies to verify the Jira integration.',
          priority: 'low',
        });
        return reply.status(200).send({ message: `Test issue created: ${issue.key}`, url: issue.url });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(400).send({ error: { code: 'JIRA_ERROR', message } });
      }
    },
  );
}
