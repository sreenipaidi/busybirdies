import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { getConfig } from './config.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { ticketRoutes } from './routes/tickets.routes.js';
import { assignmentRuleRoutes } from './routes/assignment-rules.routes.js';
import { slaPolicyRoutes } from './routes/sla-policies.routes.js';
import { cannedResponseRoutes } from './routes/canned-responses.routes.js';
import { kbRoutes } from './routes/kb.routes.js';
import { reportRoutes } from './routes/reports.routes.js';
import { csatRoutes } from './routes/csat.routes.js';
import { collisionRoutes } from './routes/collision.routes.js';
import { webhookRoutes } from './routes/webhooks.routes.js';
import { integrationRoutes } from './routes/integrations.routes.js';
import { agentGroupRoutes } from './routes/agent-groups.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';
import { registerErrorHandler } from './middleware/error-handler.middleware.js';
import { registerRequestId } from './middleware/request-id.middleware.js';
import { registerRateLimit } from './middleware/rate-limit.middleware.js';

export async function buildApp() {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  });

  // Register plugins
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(','),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 5 } }); // 10MB per file, max 5 files

  // Register request-id middleware to set X-Request-Id on all responses
  registerRequestId(app);

  // Register rate limiting middleware
  await registerRateLimit(app);

  // Register global error handler
  registerErrorHandler(app);

  // Register routes
  await app.register(healthRoutes, { prefix: '/v1' });
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(userRoutes, { prefix: '/v1' });
  await app.register(ticketRoutes, { prefix: '/v1' });
  await app.register(assignmentRuleRoutes, { prefix: '/v1' });
  await app.register(slaPolicyRoutes, { prefix: '/v1' });
  await app.register(cannedResponseRoutes, { prefix: '/v1' });
  await app.register(kbRoutes, { prefix: '/v1' });
  await app.register(reportRoutes, { prefix: '/v1' });
  await app.register(csatRoutes, { prefix: '/v1' });
  await app.register(collisionRoutes, { prefix: '/v1' });
  await app.register(agentGroupRoutes, { prefix: '/v1' });
  await app.register(tenantRoutes, { prefix: '/v1' });

  // Webhook routes -- no auth required (secured by webhook signature verification)
  await app.register(webhookRoutes, { prefix: '/v1' });
  await app.register(integrationRoutes, { prefix: '/v1' });

  return app;
}
