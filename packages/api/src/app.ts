import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { getConfig } from './config.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { ticketRoutes } from './routes/tickets.routes.js';
import { registerErrorHandler } from './middleware/error-handler.middleware.js';

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

  // Register global error handler
  registerErrorHandler(app);

  // Register routes
  await app.register(healthRoutes, { prefix: '/v1' });
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(userRoutes, { prefix: '/v1' });
  await app.register(ticketRoutes, { prefix: '/v1' });

  return app;
}
