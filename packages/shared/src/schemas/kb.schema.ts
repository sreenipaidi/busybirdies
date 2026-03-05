import { z } from 'zod';
import { ARTICLE_STATUSES } from '../constants/index.js';

export const createKBCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  display_order: z.number().int().min(0).optional(),
});

export const updateKBCategorySchema = createKBCategorySchema.partial();

export const createKBArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Body is required'),
  category_id: z.string().uuid('Invalid category ID'),
  status: z.enum(ARTICLE_STATUSES).optional().default('draft'),
});

export const updateKBArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  category_id: z.string().uuid().optional(),
  status: z.enum(ARTICLE_STATUSES).optional(),
});

export const kbArticleFeedbackSchema = z.object({
  helpful: z.boolean(),
});

export const kbSearchQuerySchema = z.object({
  q: z.string().min(3, 'Search query must be at least 3 characters'),
  portal: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export type CreateKBCategoryInput = z.infer<typeof createKBCategorySchema>;
export type UpdateKBCategoryInput = z.infer<typeof updateKBCategorySchema>;
export type CreateKBArticleInput = z.infer<typeof createKBArticleSchema>;
export type UpdateKBArticleInput = z.infer<typeof updateKBArticleSchema>;
export type KBArticleFeedbackInput = z.infer<typeof kbArticleFeedbackSchema>;
export type KBSearchQuery = z.infer<typeof kbSearchQuerySchema>;
