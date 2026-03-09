import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signToken } from '../../lib/jwt.js';
import type { KBCategory, KBArticle } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Mocks -- function names must match exactly what the routes import
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/kb.service.js', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listArticles: vi.fn(),
  getArticle: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
  submitFeedback: vi.fn(),
  searchArticles: vi.fn(),
  suggestArticles: vi.fn(),
  resolveTenantId: vi.fn(),
}));

import * as kbService from '../../services/kb.service.js';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tenantId = 'tenant-001';
const adminId = 'admin-001';
const agentId = 'agent-001';

function makeToken(userId: string, role: 'admin' | 'agent' | 'client') {
  return signToken({ sub: userId, tid: tenantId, role }, '8h');
}

const adminToken = makeToken(adminId, 'admin');
const agentToken = makeToken(agentId, 'agent');

const authorSummary = { id: adminId, full_name: 'Sarah Johnson', email: 'admin@acme.com', role: 'admin' as const };

function fakeCategory(overrides: Partial<KBCategory> = {}): KBCategory {
  return { id: 'cat-001', name: 'Getting Started', description: 'Help for new users', display_order: 1, article_count: 0, ...overrides };
}

function fakeArticle(overrides: Partial<KBArticle> = {}): KBArticle {
  return {
    id: 'article-001', title: 'How to Reset Your Password',
    slug: 'how-to-reset-your-password-abc123',
    body: '<h2>Step 1</h2><p>Go to the login page and click Forgot Password...</p>',
    status: 'draft', category: fakeCategory(), author: authorSummary,
    helpful_yes_count: 0, helpful_no_count: 0,
    created_at: '2026-03-01T10:00:00Z', updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Knowledge Base Content Lifecycle', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('should complete category creation -> article creation -> publish -> search flow', async () => {
    // Step 1: Admin creates a KB category
    vi.mocked(kbService.createCategory).mockResolvedValue(fakeCategory());

    const createCatRes = await app.inject({
      method: 'POST', url: '/v1/kb/categories',
      headers: { cookie: `session=${adminToken}` },
      payload: { name: 'Getting Started', description: 'Help for new users', display_order: 1 },
    });

    expect(createCatRes.statusCode).toBe(201);
    expect(JSON.parse(createCatRes.body).name).toBe('Getting Started');

    // Step 2: Agent creates a draft article
    vi.mocked(kbService.createArticle).mockResolvedValue(fakeArticle());

    const createArtRes = await app.inject({
      method: 'POST', url: '/v1/kb/articles',
      headers: { cookie: `session=${agentToken}` },
      payload: { title: 'How to Reset Your Password', body: '<p>Go to the login page...</p>', category_id: 'aaa11111-bbbb-cccc-dddd-eeeeeeee0001', status: 'draft' },
    });

    expect(createArtRes.statusCode).toBe(201);
    expect(JSON.parse(createArtRes.body).status).toBe('draft');

    // Step 3: Admin publishes the article
    vi.mocked(kbService.updateArticle).mockResolvedValue(fakeArticle({ status: 'published' }));

    const publishRes = await app.inject({
      method: 'PATCH', url: '/v1/kb/articles/article-001',
      headers: { cookie: `session=${adminToken}` },
      payload: { status: 'published' },
    });

    expect(publishRes.statusCode).toBe(200);
    expect(JSON.parse(publishRes.body).status).toBe('published');

    // Step 4: Public user searches
    vi.mocked(kbService.resolveTenantId).mockResolvedValue(tenantId);
    vi.mocked(kbService.searchArticles).mockResolvedValue({
      data: [{ id: 'article-001', title: 'How to Reset Your Password', slug: 'how-to-reset-your-password-abc123', category_name: 'Getting Started', snippet: 'Go to the login page...', relevance_score: 0.95 }],
      pagination: { total: 1, page: 1, per_page: 10, total_pages: 1 },
    });

    const searchRes = await app.inject({
      method: 'GET', url: '/v1/kb/search?q=password+reset&portal=acme',
    });

    expect(searchRes.statusCode).toBe(200);
    expect(JSON.parse(searchRes.body).data).toHaveLength(1);

    // Step 5: Public user reads the article
    vi.mocked(kbService.getArticle).mockResolvedValue(fakeArticle({ status: 'published' }));

    const readRes = await app.inject({
      method: 'GET', url: '/v1/kb/articles/how-to-reset-your-password-abc123?portal=acme',
    });

    expect(readRes.statusCode).toBe(200);
    expect(JSON.parse(readRes.body).title).toBe('How to Reset Your Password');
  });

  it('should allow public user to submit helpful feedback', async () => {
    vi.mocked(kbService.resolveTenantId).mockResolvedValue(tenantId);
    vi.mocked(kbService.submitFeedback).mockResolvedValue({ message: 'Thank you for your feedback.' });

    const res = await app.inject({
      method: 'POST', url: '/v1/kb/articles/article-001/feedback?portal=acme',
      payload: { helpful: true },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toContain('Thank you');
  });

  it('should list all categories with article counts for public access', async () => {
    vi.mocked(kbService.resolveTenantId).mockResolvedValue(tenantId);
    vi.mocked(kbService.listCategories).mockResolvedValue({
      data: [fakeCategory({ article_count: 5 }), fakeCategory({ id: 'cat-002', name: 'Billing', display_order: 2, article_count: 8 })],
    });

    const res = await app.inject({ method: 'GET', url: '/v1/kb/categories?portal=acme' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('should list articles filtered by status for admin', async () => {
    vi.mocked(kbService.listArticles).mockResolvedValue({
      data: [
        { id: 'article-001', title: 'Password Reset', slug: 'pw-reset', status: 'published', category_name: 'Getting Started', author_name: 'Sarah Johnson', updated_at: '2026-03-01T10:00:00Z' },
        { id: 'article-002', title: 'Billing FAQ', slug: 'billing-faq', status: 'draft', category_name: 'Billing', author_name: 'Marcus Lee', updated_at: '2026-03-02T10:00:00Z' },
      ],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    const res = await app.inject({
      method: 'GET', url: '/v1/kb/articles?status=draft',
      headers: { cookie: `session=${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toHaveLength(2);
  });

  it('should delete a KB article (admin only)', async () => {
    vi.mocked(kbService.deleteArticle).mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'DELETE', url: '/v1/kb/articles/article-001',
      headers: { cookie: `session=${adminToken}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('should prevent deleting a category with articles', async () => {
    const { ConflictError } = await import('../../lib/errors.js');
    vi.mocked(kbService.deleteCategory).mockRejectedValue(new ConflictError('Cannot delete category that contains articles'));

    const res = await app.inject({
      method: 'DELETE', url: '/v1/kb/categories/cat-001',
      headers: { cookie: `session=${adminToken}` },
    });

    expect(res.statusCode).toBe(409);
  });

  it('should return 404 for non-existent article slug', async () => {
    const { NotFoundError } = await import('../../lib/errors.js');
    vi.mocked(kbService.resolveTenantId).mockResolvedValue(tenantId);
    vi.mocked(kbService.getArticle).mockRejectedValue(new NotFoundError('Article'));

    const res = await app.inject({
      method: 'GET', url: '/v1/kb/articles/nonexistent-slug?portal=acme',
    });

    expect(res.statusCode).toBe(404);
  });

  it('should return empty results for search with no matches', async () => {
    vi.mocked(kbService.resolveTenantId).mockResolvedValue(tenantId);
    vi.mocked(kbService.searchArticles).mockResolvedValue({
      data: [], pagination: { total: 0, page: 1, per_page: 10, total_pages: 0 },
    });

    const res = await app.inject({
      method: 'GET', url: '/v1/kb/search?q=nonexistent+topic&portal=acme',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toHaveLength(0);
  });
});
