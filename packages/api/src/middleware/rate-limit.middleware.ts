import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../config.js';

/**
 * Register the @fastify/rate-limit plugin with tiered limits.
 *
 * Default limits (applied globally):
 * - Authenticated users: 100 requests/min keyed by user ID
 * - Unauthenticated users: 20 requests/min keyed by IP
 *
 * Auth-specific limits (login, register, forgot-password):
 * - 10 requests/min per IP
 *
 * The rate limiter adds standard headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - Retry-After (on 429 responses)
 */
export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Skip rate limiting in test environment to avoid flaky tests
  if (config.NODE_ENV === 'test') {
    return;
  }

  await app.register(rateLimit, {
    global: true,
    max: (request: FastifyRequest) => {
      // Authenticated users get a higher limit
      if (request.user) {
        return 100;
      }
      return 20;
    },
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request: FastifyRequest) => {
      // Use user ID for authenticated requests, IP for unauthenticated
      if (request.user) {
        return `user:${request.user.id}`;
      }
      return request.ip;
    },
    errorResponseBuilder: (request: FastifyRequest, context) => {
      return {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Rate limit exceeded, retry in ${Math.ceil((context.ttl ?? 60000) / 1000)} seconds.`,
          request_id: request.id as string,
        },
      };
    },
  });
}

/**
 * Rate limit configuration for auth endpoints (login, register, forgot-password).
 * Returns a Fastify route-level rate limit config object.
 *
 * Limits to 10 requests per minute per IP address to prevent brute-force
 * attacks on authentication endpoints.
 */
export const authRateLimitConfig = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: 60000,
      keyGenerator: (request: FastifyRequest) => request.ip,
    },
  },
};
