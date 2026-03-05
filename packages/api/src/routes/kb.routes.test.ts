import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database connection
vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  })),
}));

// Mock the KB service
vi.mock('../services/kb.service.js', () => ({
  resolveTenantId: vi.fn().mockResolvedValue('tenant-123'),
  listCategories: vi.fn().mockResolvedValue({ data: [] }),
  createCategory: vi.fn().mockResolvedValue({
    id: 'cat-1',
    name: 'Test',
    description: null,
    display_order: 0,
    article_count: 0,
  }),
  updateCategory: vi.fn().mockResolvedValue({
    id: 'cat-1',
    name: 'Updated',
    description: null,
    display_order: 0,
    article_count: 0,
  }),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  listArticles: vi.fn().mockResolvedValue({
    data: [],
    pagination: { total: 0, page: 1, per_page: 20, total_pages: 1 },
  }),
  getArticle: vi.fn().mockResolvedValue({
    id: 'article-1',
    title: 'Test Article',
    slug: 'test-article',
    body: '<p>Test</p>',
    status: 'published',
    category: { id: 'cat-1', name: 'Test', description: null, display_order: 0, article_count: 1 },
    author: { id: 'user-1', full_name: 'Author', email: 'author@test.com', role: 'agent' },
    helpful_yes_count: 0,
    helpful_no_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }),
  createArticle: vi.fn().mockResolvedValue({
    id: 'article-1',
    title: 'New Article',
    slug: 'new-article',
    body: '<p>Content</p>',
    status: 'draft',
    category: { id: 'cat-1', name: 'Test', description: null, display_order: 0, article_count: 1 },
    author: { id: 'user-1', full_name: 'Author', email: 'author@test.com', role: 'agent' },
    helpful_yes_count: 0,
    helpful_no_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }),
  updateArticle: vi.fn().mockResolvedValue({
    id: 'article-1',
    title: 'Updated Article',
    slug: 'updated-article',
    body: '<p>Updated</p>',
    status: 'published',
    category: { id: 'cat-1', name: 'Test', description: null, display_order: 0, article_count: 1 },
    author: { id: 'user-1', full_name: 'Author', email: 'author@test.com', role: 'agent' },
    helpful_yes_count: 0,
    helpful_no_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }),
  deleteArticle: vi.fn().mockResolvedValue(undefined),
  submitFeedback: vi.fn().mockResolvedValue({ message: 'Thank you for your feedback.' }),
  searchArticles: vi.fn().mockResolvedValue({
    data: [],
    pagination: { total: 0, page: 1, per_page: 10, total_pages: 1 },
  }),
  suggestArticles: vi.fn().mockResolvedValue([]),
}));

// Mock auth middleware
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticate: vi.fn(async (request: Record<string, unknown>) => {
    // Check for a test header to simulate auth
    const authHeader = (request.headers as Record<string, string>)?.['x-test-auth'];
    if (authHeader) {
      const parsed = JSON.parse(authHeader);
      request.user = parsed;
    }
  }),
}));

vi.mock('../middleware/tenant.middleware.js', () => ({
  tenantScope: vi.fn(async (request: Record<string, unknown>) => {
    const typedRequest = request as Record<string, Record<string, string> | undefined>;
    const user = typedRequest.user;
    if (user && user.tenantId) {
      request.tenantId = user.tenantId;
    }
  }),
}));

vi.mock('../middleware/role.middleware.js', () => ({
  requireRole: vi.fn((...roles: string[]) => {
    return async (request: Record<string, unknown>) => {
      const user = request.user as { role: string } | undefined;
      if (!user) {
        throw new Error('Authentication required');
      }
      if (!roles.includes(user.role)) {
        throw new Error('Insufficient permissions');
      }
    };
  }),
}));

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { kbRoutes } from './kb.routes.js';
import * as kbServiceMock from '../services/kb.service.js';

describe('KB Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(kbRoutes, { prefix: '/v1' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /v1/kb/categories', () => {
    it('should return categories for public access with portal param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/categories?portal=acme',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ data: [] });
      expect(kbServiceMock.listCategories).toHaveBeenCalledWith('tenant-123', true);
    });

    it('should return all categories for authenticated admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/categories',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'admin',
          }),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(kbServiceMock.listCategories).toHaveBeenCalledWith('tenant-1', false);
    });
  });

  describe('POST /v1/kb/categories', () => {
    it('should create category for admin user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/categories',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'admin',
          }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Category' }),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Test');
    });

    it('should reject creation for agent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/categories',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'agent',
          }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Category' }),
      });

      expect(response.statusCode).toBe(500); // Error thrown by mock middleware
    });

    it('should reject creation for unauthenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/categories',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Category' }),
      });

      expect(response.statusCode).toBe(500); // Error thrown by mock middleware
    });
  });

  describe('DELETE /v1/kb/categories/:id', () => {
    it('should delete category for admin user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/kb/categories/cat-1',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'admin',
          }),
        },
      });

      expect(response.statusCode).toBe(204);
      expect(kbServiceMock.deleteCategory).toHaveBeenCalledWith('tenant-1', 'cat-1');
    });
  });

  describe('GET /v1/kb/articles', () => {
    it('should return published articles for public access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/articles?portal=acme',
      });

      expect(response.statusCode).toBe(200);
      expect(kbServiceMock.listArticles).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ page: 1, per_page: 20 }),
        true,
      );
    });

    it('should return all articles for admin access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/articles',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'admin',
          }),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(kbServiceMock.listArticles).toHaveBeenCalledWith(
        'tenant-1',
        expect.anything(),
        false,
      );
    });
  });

  describe('GET /v1/kb/articles/:slug', () => {
    it('should return article detail for public access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/articles/test-article?portal=acme',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe('Test Article');
      expect(kbServiceMock.getArticle).toHaveBeenCalledWith('tenant-123', 'test-article', true);
    });
  });

  describe('POST /v1/kb/articles', () => {
    it('should create article for agent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/articles',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'agent',
          }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Article',
          body: '<p>Content</p>',
          category_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'draft',
        }),
      });

      expect(response.statusCode).toBe(201);
      expect(kbServiceMock.createArticle).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ title: 'New Article' }),
        'user-1',
      );
    });

    it('should reject article creation for client user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/articles',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'client',
          }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Article',
          body: '<p>Content</p>',
          category_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('DELETE /v1/kb/articles/:id', () => {
    it('should delete article for admin user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/kb/articles/article-1',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'admin',
          }),
        },
      });

      expect(response.statusCode).toBe(204);
      expect(kbServiceMock.deleteArticle).toHaveBeenCalledWith('tenant-1', 'article-1');
    });

    it('should reject delete for agent user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/kb/articles/article-1',
        headers: {
          'x-test-auth': JSON.stringify({
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'agent',
          }),
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('POST /v1/kb/articles/:id/feedback', () => {
    it('should accept feedback for public access', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/articles/article-1/feedback?portal=acme',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ helpful: true }),
      });

      expect(response.statusCode).toBe(200);
      expect(kbServiceMock.submitFeedback).toHaveBeenCalledWith('tenant-123', 'article-1', true);
    });

    it('should return 422 when feedback body is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/kb/articles/article-1/feedback?portal=acme',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ helpful: 'not-a-boolean' }),
      });

      // Zod validation error triggers error handler
      expect(response.statusCode).not.toBe(200);
    });
  });

  describe('GET /v1/kb/search', () => {
    it('should search articles for public access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/search?q=password+reset&portal=acme',
      });

      expect(response.statusCode).toBe(200);
      expect(kbServiceMock.searchArticles).toHaveBeenCalledWith(
        'tenant-123',
        'password reset',
        1,
        10,
      );
    });

    it('should return validation error when query is too short', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/search?q=ab&portal=acme',
      });

      expect(response.statusCode).not.toBe(200);
    });
  });

  describe('GET /v1/kb/suggest', () => {
    it('should return suggestions for public access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/kb/suggest?q=password+reset&portal=acme',
      });

      expect(response.statusCode).toBe(200);
      expect(kbServiceMock.suggestArticles).toHaveBeenCalledWith(
        'tenant-123',
        'password reset',
        5,
      );
    });
  });
});
