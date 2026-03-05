import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createKBCategorySchema,
  updateKBCategorySchema,
  createKBArticleSchema,
  updateKBArticleSchema,
  kbArticleFeedbackSchema,
  kbSearchQuerySchema,
} from '@supportdesk/shared';
import * as kbService from '../services/kb.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/** Schema for article list query params. */
const articleListQuerySchema = z.object({
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published']).optional(),
  search: z.string().optional(),
  portal: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Schema for category list query params. */
const categoryListQuerySchema = z.object({
  portal: z.string().optional(),
});

/** Schema for article detail query params. */
const articleDetailQuerySchema = z.object({
  portal: z.string().optional(),
});

/** Schema for suggest query params. */
const suggestQuerySchema = z.object({
  q: z.string().min(3, 'Search query must be at least 3 characters'),
  portal: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

/**
 * Attempt optional authentication. If a session cookie is present and valid,
 * populates request.user. Otherwise, request.user remains undefined.
 * Never throws -- silently skips auth for unauthenticated requests.
 */
async function optionalAuth(
  request: Parameters<typeof authenticate>[0],
  reply: Parameters<typeof authenticate>[1],
): Promise<void> {
  try {
    await authenticate(request, reply);
  } catch {
    // Silently ignore auth errors -- this is an optional auth route
  }
}

/**
 * Determine whether the current request is from an admin or agent user.
 */
function isStaffUser(request: { user?: { role: string } }): boolean {
  return request.user?.role === 'admin' || request.user?.role === 'agent';
}

/**
 * Resolve tenant ID from either the authenticated user or the portal query param.
 * Throws if neither is available.
 */
async function resolveTenantFromRequest(
  request: { user?: { tenantId: string }; tenantId?: string },
  portal?: string,
): Promise<string> {
  if (request.user?.tenantId) {
    return request.user.tenantId;
  }
  if (request.tenantId) {
    return request.tenantId;
  }
  if (portal) {
    return kbService.resolveTenantId(portal);
  }
  throw new Error('Unable to determine tenant. Provide a portal query parameter.');
}

/**
 * Register all Knowledge Base routes.
 * Public endpoints use optional auth -- unauthenticated users see published content only.
 * Admin endpoints require authentication and appropriate roles.
 */
export async function kbRoutes(app: FastifyInstance): Promise<void> {
  // ---- CATEGORIES ----

  /**
   * GET /v1/kb/categories
   * List categories with article counts.
   * Public: anyone can view (published article counts only for unauthenticated/clients).
   * Authenticated admin/agent: sees all article counts.
   */
  app.get(
    '/kb/categories',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const query = categoryListQuerySchema.parse(request.query);
      const tenantId = await resolveTenantFromRequest(request, query.portal);
      const publishedOnly = !isStaffUser(request);

      const result = await kbService.listCategories(tenantId, publishedOnly);
      return reply.status(200).send(result);
    },
  );

  /**
   * POST /v1/kb/categories
   * Create a new category. Admin only.
   */
  app.post(
    '/kb/categories',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const body = createKBCategorySchema.parse(request.body);
      const result = await kbService.createCategory(request.tenantId!, body);
      return reply.status(201).send(result);
    },
  );

  /**
   * PATCH /v1/kb/categories/:id
   * Update a category. Admin only.
   */
  app.patch(
    '/kb/categories/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateKBCategorySchema.parse(request.body);
      const result = await kbService.updateCategory(request.tenantId!, id, body);
      return reply.status(200).send(result);
    },
  );

  /**
   * DELETE /v1/kb/categories/:id
   * Delete a category. Admin only. Fails if category has articles.
   */
  app.delete(
    '/kb/categories/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await kbService.deleteCategory(request.tenantId!, id);
      return reply.status(204).send();
    },
  );

  // ---- ARTICLES ----

  /**
   * GET /v1/kb/articles
   * List articles with filtering and pagination.
   * Public: only published articles. Admin/agent: all statuses.
   */
  app.get(
    '/kb/articles',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const query = articleListQuerySchema.parse(request.query);
      const tenantId = await resolveTenantFromRequest(request, query.portal);
      const publishedOnly = !isStaffUser(request);

      const result = await kbService.listArticles(tenantId, query, publishedOnly);
      return reply.status(200).send(result);
    },
  );

  /**
   * GET /v1/kb/articles/:slug
   * Get a single article by slug.
   * Public: only published articles. Admin/agent: any status.
   */
  app.get(
    '/kb/articles/:slug',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const query = articleDetailQuerySchema.parse(request.query);
      const tenantId = await resolveTenantFromRequest(request, query.portal);
      const publishedOnly = !isStaffUser(request);

      const result = await kbService.getArticle(tenantId, slug, publishedOnly);
      return reply.status(200).send(result);
    },
  );

  /**
   * POST /v1/kb/articles
   * Create a new article. Agent/admin only.
   */
  app.post(
    '/kb/articles',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const body = createKBArticleSchema.parse(request.body);
      const user = request.user!;
      const result = await kbService.createArticle(request.tenantId!, body, user.id);
      return reply.status(201).send(result);
    },
  );

  /**
   * PATCH /v1/kb/articles/:id
   * Update an article. Agent/admin only.
   */
  app.patch(
    '/kb/articles/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin', 'agent')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateKBArticleSchema.parse(request.body);
      const result = await kbService.updateArticle(request.tenantId!, id, body);
      return reply.status(200).send(result);
    },
  );

  /**
   * DELETE /v1/kb/articles/:id
   * Delete an article. Admin only.
   */
  app.delete(
    '/kb/articles/:id',
    { preHandler: [authenticate, tenantScope, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await kbService.deleteArticle(request.tenantId!, id);
      return reply.status(204).send();
    },
  );

  /**
   * POST /v1/kb/articles/:id/feedback
   * Submit "Was this helpful?" feedback. Public endpoint.
   */
  app.post(
    '/kb/articles/:id/feedback',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = kbArticleFeedbackSchema.parse(request.body);

      // Resolve tenant from user or portal param
      const queryParams = request.query as { portal?: string };
      const tenantId = await resolveTenantFromRequest(request, queryParams.portal);

      const result = await kbService.submitFeedback(tenantId, id, body.helpful);
      return reply.status(200).send(result);
    },
  );

  // ---- SEARCH ----

  /**
   * GET /v1/kb/search
   * Full-text search of published KB articles. Public endpoint.
   */
  app.get(
    '/kb/search',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const query = kbSearchQuerySchema.parse(request.query);
      const tenantId = await resolveTenantFromRequest(request, query.portal);

      const result = await kbService.searchArticles(
        tenantId,
        query.q,
        query.page,
        query.per_page,
      );
      return reply.status(200).send(result);
    },
  );

  // ---- SUGGEST ----

  /**
   * GET /v1/kb/suggest
   * Suggest relevant articles for pre-ticket deflection. Public endpoint.
   */
  app.get(
    '/kb/suggest',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const query = suggestQuerySchema.parse(request.query);
      const tenantId = await resolveTenantFromRequest(request, query.portal);

      const results = await kbService.suggestArticles(tenantId, query.q, query.limit);
      return reply.status(200).send({ data: results });
    },
  );
}
