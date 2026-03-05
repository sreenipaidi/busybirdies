import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ConflictError, AppError } from '../lib/errors.js';

// ---- Mock database layer ----

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteFn = vi.fn();

const createChainedQuery = (finalResult: unknown = []) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(finalResult);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  // Make the chain itself thenable to resolve to finalResult
  chain.then = (resolve: (v: unknown) => void) => resolve(finalResult);
  return chain;
};

vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDeleteFn,
  })),
}));

// Import service after mocks are set up
import * as kbService from './kb.service.js';

describe('KB Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCategories', () => {
    it('should return an empty data array when no categories exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      const result = await kbService.listCategories('tenant-1', true);

      expect(result).toEqual({ data: [] });
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should return categories with article counts', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Getting Started',
          description: 'Help for new users',
          displayOrder: 0,
          articleCount: 5,
        },
        {
          id: 'cat-2',
          name: 'Billing',
          description: null,
          displayOrder: 1,
          articleCount: 3,
        },
      ];

      const chain = createChainedQuery(mockCategories);
      mockSelect.mockReturnValue(chain);

      const result = await kbService.listCategories('tenant-1', false);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'cat-1',
        name: 'Getting Started',
        description: 'Help for new users',
        display_order: 0,
        article_count: 5,
      });
      expect(result.data[1]).toEqual({
        id: 'cat-2',
        name: 'Billing',
        description: null,
        display_order: 1,
        article_count: 3,
      });
    });
  });

  describe('createCategory', () => {
    it('should throw ConflictError when category name already exists', async () => {
      // First call: check for existing category - found
      const existingChain = createChainedQuery([{ id: 'existing-cat' }]);
      mockSelect.mockReturnValue(existingChain);

      await expect(
        kbService.createCategory('tenant-1', { name: 'Existing Category' }),
      ).rejects.toThrow(ConflictError);
    });

    it('should create a category successfully when name is unique', async () => {
      // First call: check for existing - not found
      const notFoundChain = createChainedQuery([]);
      // Second call: get max order
      const maxOrderChain = createChainedQuery([{ maxOrder: 2 }]);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return notFoundChain;
        return maxOrderChain;
      });

      const insertedRow = {
        id: 'new-cat-id',
        name: 'New Category',
        description: 'A new category',
        displayOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertChain = createChainedQuery([insertedRow]);
      mockInsert.mockReturnValue(insertChain);

      const result = await kbService.createCategory('tenant-1', {
        name: 'New Category',
        description: 'A new category',
      });

      expect(result.id).toBe('new-cat-id');
      expect(result.name).toBe('New Category');
      expect(result.description).toBe('A new category');
      expect(result.article_count).toBe(0);
    });

    it('should throw AppError when insert fails', async () => {
      const notFoundChain = createChainedQuery([]);
      const maxOrderChain = createChainedQuery([{ maxOrder: 0 }]);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return notFoundChain;
        return maxOrderChain;
      });

      // Insert returns empty result
      const insertChain = createChainedQuery([]);
      mockInsert.mockReturnValue(insertChain);

      await expect(
        kbService.createCategory('tenant-1', { name: 'Failed Category' }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateCategory', () => {
    it('should throw NotFoundError when category does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.updateCategory('tenant-1', 'non-existent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when renaming to an existing name', async () => {
      // First call: category exists
      const existingChain = createChainedQuery([
        { id: 'cat-1', name: 'Old Name', description: null, displayOrder: 0 },
      ]);
      // Second call: duplicate check - found
      const duplicateChain = createChainedQuery([{ id: 'cat-2' }]);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existingChain;
        return duplicateChain;
      });

      await expect(
        kbService.updateCategory('tenant-1', 'cat-1', { name: 'Duplicate Name' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('deleteCategory', () => {
    it('should throw NotFoundError when category does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.deleteCategory('tenant-1', 'non-existent'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when category has articles', async () => {
      // First call: category exists
      const existingChain = createChainedQuery([{ id: 'cat-1' }]);
      // Second call: count articles - has articles
      const countChain = createChainedQuery([{ total: 3 }]);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existingChain;
        return countChain;
      });

      await expect(
        kbService.deleteCategory('tenant-1', 'cat-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('should delete category when it exists and has no articles', async () => {
      // First call: category exists
      const existingChain = createChainedQuery([{ id: 'cat-1' }]);
      // Second call: count articles - no articles
      const countChain = createChainedQuery([{ total: 0 }]);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existingChain;
        return countChain;
      });

      const deleteChain = createChainedQuery([]);
      mockDeleteFn.mockReturnValue(deleteChain);

      await expect(
        kbService.deleteCategory('tenant-1', 'cat-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteArticle', () => {
    it('should throw NotFoundError when article does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.deleteArticle('tenant-1', 'non-existent'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should delete article when it exists', async () => {
      const existingChain = createChainedQuery([{ id: 'article-1' }]);
      mockSelect.mockReturnValue(existingChain);

      const deleteChain = createChainedQuery([]);
      mockDeleteFn.mockReturnValue(deleteChain);

      await expect(
        kbService.deleteArticle('tenant-1', 'article-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('submitFeedback', () => {
    it('should throw NotFoundError when article does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.submitFeedback('tenant-1', 'non-existent', true),
      ).rejects.toThrow(NotFoundError);
    });

    it('should increment helpful_yes_count when helpful is true', async () => {
      const existingChain = createChainedQuery([{ id: 'article-1' }]);
      mockSelect.mockReturnValue(existingChain);

      const updateChain = createChainedQuery([]);
      mockUpdate.mockReturnValue(updateChain);

      const result = await kbService.submitFeedback('tenant-1', 'article-1', true);

      expect(result.message).toBe('Thank you for your feedback.');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should increment helpful_no_count when helpful is false', async () => {
      const existingChain = createChainedQuery([{ id: 'article-1' }]);
      mockSelect.mockReturnValue(existingChain);

      const updateChain = createChainedQuery([]);
      mockUpdate.mockReturnValue(updateChain);

      const result = await kbService.submitFeedback('tenant-1', 'article-1', false);

      expect(result.message).toBe('Thank you for your feedback.');
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('createArticle', () => {
    it('should throw NotFoundError when category does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.createArticle(
          'tenant-1',
          {
            title: 'Test Article',
            body: '<p>Content</p>',
            category_id: 'non-existent-cat',
            status: 'draft',
          },
          'author-1',
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateArticle', () => {
    it('should throw NotFoundError when article does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.updateArticle('tenant-1', 'non-existent', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getArticle', () => {
    it('should throw NotFoundError when article does not exist', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.getArticle('tenant-1', 'non-existent-slug', true),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('resolveTenantId', () => {
    it('should throw NotFoundError when portal subdomain is not found', async () => {
      const chain = createChainedQuery([]);
      mockSelect.mockReturnValue(chain);

      await expect(
        kbService.resolveTenantId('unknown-portal'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should return tenant id when portal subdomain is found', async () => {
      const chain = createChainedQuery([{ id: 'tenant-123' }]);
      mockSelect.mockReturnValue(chain);

      const result = await kbService.resolveTenantId('acme');
      expect(result).toBe('tenant-123');
    });
  });

  describe('suggestArticles', () => {
    it('should return an empty array when no matches found', async () => {
      // searchArticles calls: count + get rows
      const countChain = createChainedQuery([{ total: 0 }]);
      const rowsChain = createChainedQuery([]);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return countChain;
        return rowsChain;
      });

      const result = await kbService.suggestArticles('tenant-1', 'unknown query');
      expect(result).toEqual([]);
    });
  });
});
