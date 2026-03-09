import { eq, and, sql, count, desc, asc, ilike } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { kbCategories, kbArticles, users, tenants } from '../db/schema.js';
import {
  AppError,
  NotFoundError,
  ConflictError,
} from '../lib/errors.js';
import { sanitizeRichText } from '../lib/sanitize.js';
import type {
  KBCategory,
  KBArticle,
  KBArticleListItem,
  KBSearchResult,
  PaginatedResponse,
  UserSummary,
  CreateKBCategoryInput,
  UpdateKBCategoryInput,
  CreateKBArticleInput,
  UpdateKBArticleInput,
} from '@busybirdies/shared';
import type { ArticleStatus, UserRole } from '@busybirdies/shared';

/**
 * Generate a URL-safe slug from a title string.
 * Handles unicode, strips non-alphanumeric characters, and appends a short random suffix
 * to avoid collisions.
 */
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 180);

  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

/** Internal type for DB user rows used in KB operations. */
interface DbUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/**
 * Convert a DB user row to a UserSummary response shape.
 */
function toUserSummary(user: DbUser): UserSummary {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role as UserRole,
  };
}

/**
 * Look up a user by ID within a tenant. Returns null if not found.
 */
async function findUser(tenantId: string, userId: string): Promise<DbUser | null> {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  return user ?? null;
}

/**
 * Resolve a tenant ID from a portal subdomain.
 * Throws NotFoundError if the subdomain is not found.
 */
export async function resolveTenantId(portal: string): Promise<string> {
  const db = getDb();
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.subdomain, portal))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Portal');
  }

  return tenant.id;
}

/**
 * List all KB categories for a tenant, ordered by display_order.
 * Includes the article count for each category.
 * When publishedOnly is true, only counts published articles.
 */
export async function listCategories(
  tenantId: string,
  publishedOnly: boolean,
): Promise<{ data: KBCategory[] }> {
  const db = getDb();

  const statusCondition = publishedOnly
    ? sql`AND ${kbArticles.status} = 'published'`
    : sql``;

  const rows = await db
    .select({
      id: kbCategories.id,
      name: kbCategories.name,
      description: kbCategories.description,
      displayOrder: kbCategories.displayOrder,
      articleCount: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM kb_articles
        WHERE kb_articles.category_id = ${kbCategories.id}
        AND kb_articles.tenant_id = ${kbCategories.tenantId}
        ${statusCondition}
      ), 0)`,
    })
    .from(kbCategories)
    .where(eq(kbCategories.tenantId, tenantId))
    .orderBy(asc(kbCategories.displayOrder), asc(kbCategories.name));

  const data: KBCategory[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    display_order: row.displayOrder,
    article_count: Number(row.articleCount),
  }));

  return { data };
}

/**
 * Create a new KB category within a tenant.
 * Throws ConflictError if a category with the same name already exists.
 */
export async function createCategory(
  tenantId: string,
  input: CreateKBCategoryInput,
): Promise<KBCategory> {
  const db = getDb();

  // Check for duplicate name
  const [existing] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(and(eq(kbCategories.tenantId, tenantId), eq(kbCategories.name, input.name)))
    .limit(1);

  if (existing) {
    throw new ConflictError('A category with this name already exists');
  }

  // If no display_order provided, put at end
  let displayOrder = input.display_order;
  if (displayOrder === undefined) {
    const [maxResult] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${kbCategories.displayOrder}), -1)` })
      .from(kbCategories)
      .where(eq(kbCategories.tenantId, tenantId));

    displayOrder = (maxResult?.maxOrder ?? -1) + 1;
  }

  const [row] = await db
    .insert(kbCategories)
    .values({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      displayOrder,
    })
    .returning();

  if (!row) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create category');
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    display_order: row.displayOrder,
    article_count: 0,
  };
}

/**
 * Update an existing KB category.
 * Throws NotFoundError if the category does not exist.
 * Throws ConflictError if the new name conflicts with another category.
 */
export async function updateCategory(
  tenantId: string,
  categoryId: string,
  input: UpdateKBCategoryInput,
): Promise<KBCategory> {
  const db = getDb();

  // Verify category exists
  const [existing] = await db
    .select()
    .from(kbCategories)
    .where(and(eq(kbCategories.id, categoryId), eq(kbCategories.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Category');
  }

  // Check for duplicate name if name is being changed
  if (input.name && input.name !== existing.name) {
    const [duplicate] = await db
      .select({ id: kbCategories.id })
      .from(kbCategories)
      .where(
        and(
          eq(kbCategories.tenantId, tenantId),
          eq(kbCategories.name, input.name),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictError('A category with this name already exists');
    }
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateValues.name = input.name;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.display_order !== undefined) updateValues.displayOrder = input.display_order;

  await db
    .update(kbCategories)
    .set(updateValues)
    .where(eq(kbCategories.id, categoryId));

  // Get article count
  const [countResult] = await db
    .select({ total: count() })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.categoryId, categoryId),
        eq(kbArticles.tenantId, tenantId),
      ),
    );

  const [updated] = await db
    .select()
    .from(kbCategories)
    .where(eq(kbCategories.id, categoryId))
    .limit(1);

  if (!updated) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve updated category');
  }

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description ?? null,
    display_order: updated.displayOrder,
    article_count: countResult?.total ?? 0,
  };
}

/**
 * Delete a KB category by ID.
 * Throws NotFoundError if the category does not exist.
 * Throws ConflictError if the category still has articles.
 */
export async function deleteCategory(
  tenantId: string,
  categoryId: string,
): Promise<void> {
  const db = getDb();

  // Verify category exists
  const [existing] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(and(eq(kbCategories.id, categoryId), eq(kbCategories.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Category');
  }

  // Check for articles
  const [countResult] = await db
    .select({ total: count() })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.categoryId, categoryId),
        eq(kbArticles.tenantId, tenantId),
      ),
    );

  if ((countResult?.total ?? 0) > 0) {
    throw new ConflictError('Cannot delete a category that has articles');
  }

  await db
    .delete(kbCategories)
    .where(eq(kbCategories.id, categoryId));
}

/**
 * Build a full KBArticle response from a DB article row.
 */
async function buildArticleResponse(
  tenantId: string,
  row: {
    id: string;
    title: string;
    slug: string;
    body: string;
    status: string;
    categoryId: string;
    authorId: string;
    helpfulYesCount: number;
    helpfulNoCount: number;
    createdAt: Date;
    updatedAt: Date;
  },
): Promise<KBArticle> {
  const db = getDb();

  // Get category
  const [category] = await db
    .select()
    .from(kbCategories)
    .where(eq(kbCategories.id, row.categoryId))
    .limit(1);

  // Get article count for category
  const [catCount] = await db
    .select({ total: count() })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.categoryId, row.categoryId),
        eq(kbArticles.tenantId, tenantId),
      ),
    );

  const author = await findUser(tenantId, row.authorId);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    status: row.status as ArticleStatus,
    category: category
      ? {
          id: category.id,
          name: category.name,
          description: category.description ?? null,
          display_order: category.displayOrder,
          article_count: catCount?.total ?? 0,
        }
      : { id: row.categoryId, name: 'Unknown', description: null, display_order: 0, article_count: 0 },
    author: author
      ? toUserSummary(author)
      : { id: row.authorId, full_name: 'Unknown', email: '', role: 'agent' as UserRole },
    helpful_yes_count: row.helpfulYesCount,
    helpful_no_count: row.helpfulNoCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Filters for listing articles. */
export interface ArticleListFilters {
  category_id?: string;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

/**
 * List KB articles with filtering and pagination.
 * When publishedOnly is true, only published articles are returned (for public/client access).
 */
export async function listArticles(
  tenantId: string,
  filters: ArticleListFilters,
  publishedOnly: boolean,
): Promise<PaginatedResponse<KBArticleListItem>> {
  const db = getDb();
  const page = filters.page ?? 1;
  const perPage = filters.per_page ?? 20;
  const offset = (page - 1) * perPage;

  const conditions = [eq(kbArticles.tenantId, tenantId)];

  if (publishedOnly) {
    conditions.push(eq(kbArticles.status, 'published'));
  } else if (filters.status) {
    conditions.push(eq(kbArticles.status, filters.status));
  }

  if (filters.category_id) {
    conditions.push(eq(kbArticles.categoryId, filters.category_id));
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(ilike(kbArticles.title, searchPattern));
  }

  const whereClause = and(...conditions);

  // Count total
  const [countResult] = await db
    .select({ total: count() })
    .from(kbArticles)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Get articles joined with category and author
  const rows = await db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      slug: kbArticles.slug,
      status: kbArticles.status,
      categoryId: kbArticles.categoryId,
      authorId: kbArticles.authorId,
      updatedAt: kbArticles.updatedAt,
    })
    .from(kbArticles)
    .where(whereClause)
    .orderBy(desc(kbArticles.updatedAt))
    .limit(perPage)
    .offset(offset);

  const data: KBArticleListItem[] = await Promise.all(
    rows.map(async (row) => {
      // Get category name
      const [category] = await db
        .select({ name: kbCategories.name })
        .from(kbCategories)
        .where(eq(kbCategories.id, row.categoryId))
        .limit(1);

      // Get author name
      const author = await findUser(tenantId, row.authorId);

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status as ArticleStatus,
        category_name: category?.name ?? 'Unknown',
        author_name: author?.fullName ?? 'Unknown',
        updated_at: row.updatedAt.toISOString(),
      };
    }),
  );

  return {
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage) || 1,
    },
  };
}

/**
 * Get a single KB article by its slug.
 * When publishedOnly is true, only published articles are returned (for public/client access).
 * Throws NotFoundError if the article is not found or not accessible.
 */
export async function getArticle(
  tenantId: string,
  slug: string,
  publishedOnly: boolean,
): Promise<KBArticle> {
  const db = getDb();

  const conditions = [
    eq(kbArticles.tenantId, tenantId),
    eq(kbArticles.slug, slug),
  ];

  if (publishedOnly) {
    conditions.push(eq(kbArticles.status, 'published'));
  }

  const [row] = await db
    .select()
    .from(kbArticles)
    .where(and(...conditions))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Article');
  }

  return buildArticleResponse(tenantId, row);
}

/**
 * Create a new KB article within a tenant.
 * The slug is auto-generated from the title.
 * Throws NotFoundError if the specified category does not exist.
 */
export async function createArticle(
  tenantId: string,
  input: CreateKBArticleInput,
  authorId: string,
): Promise<KBArticle> {
  const db = getDb();

  // Verify category exists
  const [category] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.id, input.category_id),
        eq(kbCategories.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!category) {
    throw new NotFoundError('Category');
  }

  const slug = generateSlug(input.title);

  // Sanitize the article body to prevent stored XSS
  const sanitizedBody = sanitizeRichText(input.body);

  const [row] = await db
    .insert(kbArticles)
    .values({
      tenantId,
      categoryId: input.category_id,
      title: input.title,
      slug,
      body: sanitizedBody,
      status: input.status ?? 'draft',
      authorId,
    })
    .returning();

  if (!row) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create article');
  }

  return buildArticleResponse(tenantId, row);
}

/**
 * Update an existing KB article.
 * Throws NotFoundError if the article does not exist.
 * If category_id is changed, validates the new category exists.
 */
export async function updateArticle(
  tenantId: string,
  articleId: string,
  input: UpdateKBArticleInput,
): Promise<KBArticle> {
  const db = getDb();

  // Verify article exists
  const [existing] = await db
    .select()
    .from(kbArticles)
    .where(and(eq(kbArticles.id, articleId), eq(kbArticles.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Article');
  }

  // If changing category, validate it exists
  if (input.category_id && input.category_id !== existing.categoryId) {
    const [category] = await db
      .select({ id: kbCategories.id })
      .from(kbCategories)
      .where(
        and(
          eq(kbCategories.id, input.category_id),
          eq(kbCategories.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!category) {
      throw new NotFoundError('Category');
    }
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) {
    updateValues.title = input.title;
    updateValues.slug = generateSlug(input.title);
  }
  if (input.body !== undefined) updateValues.body = sanitizeRichText(input.body);
  if (input.category_id !== undefined) updateValues.categoryId = input.category_id;
  if (input.status !== undefined) updateValues.status = input.status;

  await db
    .update(kbArticles)
    .set(updateValues)
    .where(eq(kbArticles.id, articleId));

  // Fetch updated row
  const [updated] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);

  if (!updated) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve updated article');
  }

  return buildArticleResponse(tenantId, updated);
}

/**
 * Delete a KB article by ID. Only admins should be able to call this.
 * Throws NotFoundError if the article does not exist.
 */
export async function deleteArticle(
  tenantId: string,
  articleId: string,
): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(and(eq(kbArticles.id, articleId), eq(kbArticles.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Article');
  }

  await db
    .delete(kbArticles)
    .where(eq(kbArticles.id, articleId));
}

/**
 * Submit feedback (helpful yes/no) for a KB article.
 * Increments the appropriate counter on the article.
 * Throws NotFoundError if the article does not exist.
 */
export async function submitFeedback(
  tenantId: string,
  articleId: string,
  helpful: boolean,
): Promise<{ message: string }> {
  const db = getDb();

  const [existing] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.id, articleId),
        eq(kbArticles.tenantId, tenantId),
        eq(kbArticles.status, 'published'),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Article');
  }

  if (helpful) {
    await db
      .update(kbArticles)
      .set({ helpfulYesCount: sql`${kbArticles.helpfulYesCount} + 1` })
      .where(eq(kbArticles.id, articleId));
  } else {
    await db
      .update(kbArticles)
      .set({ helpfulNoCount: sql`${kbArticles.helpfulNoCount} + 1` })
      .where(eq(kbArticles.id, articleId));
  }

  return { message: 'Thank you for your feedback.' };
}

/**
 * Search published KB articles using PostgreSQL full-text search.
 * Uses to_tsvector and plainto_tsquery for relevance ranking.
 * Returns results with highlighted snippets.
 */
export async function searchArticles(
  tenantId: string,
  query: string,
  page: number = 1,
  perPage: number = 10,
): Promise<PaginatedResponse<KBSearchResult>> {
  const db = getDb();
  const offset = (page - 1) * perPage;

  // Use PostgreSQL full-text search
  const tsQuery = sql`plainto_tsquery('english', ${query})`;

  // Count total matches
  const [countResult] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.tenantId, tenantId),
        eq(kbArticles.status, 'published'),
        sql`(
          to_tsvector('english', ${kbArticles.title} || ' ' || ${kbArticles.body})
          @@ ${tsQuery}
          OR ${kbArticles.title} ILIKE ${'%' + query + '%'}
        )`,
      ),
    );

  const total = countResult?.total ?? 0;

  // Get matching articles with relevance score and snippet
  const rows = await db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      slug: kbArticles.slug,
      categoryId: kbArticles.categoryId,
      body: kbArticles.body,
      relevanceScore: sql<number>`ts_rank(
        to_tsvector('english', ${kbArticles.title} || ' ' || ${kbArticles.body}),
        ${tsQuery}
      )`,
      snippet: sql<string>`ts_headline(
        'english',
        ${kbArticles.body},
        ${tsQuery},
        'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
      )`,
    })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.tenantId, tenantId),
        eq(kbArticles.status, 'published'),
        sql`(
          to_tsvector('english', ${kbArticles.title} || ' ' || ${kbArticles.body})
          @@ ${tsQuery}
          OR ${kbArticles.title} ILIKE ${'%' + query + '%'}
        )`,
      ),
    )
    .orderBy(
      sql`ts_rank(
        to_tsvector('english', ${kbArticles.title} || ' ' || ${kbArticles.body}),
        ${tsQuery}
      ) DESC`,
    )
    .limit(perPage)
    .offset(offset);

  const data: KBSearchResult[] = await Promise.all(
    rows.map(async (row) => {
      const [category] = await db
        .select({ name: kbCategories.name })
        .from(kbCategories)
        .where(eq(kbCategories.id, row.categoryId))
        .limit(1);

      // If FTS produced no snippet (ILIKE-only match), create a manual one
      let snippet = row.snippet;
      if (!snippet || snippet === row.body) {
        snippet = row.body.substring(0, 200) + (row.body.length > 200 ? '...' : '');
      }

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        category_name: category?.name ?? 'Unknown',
        snippet,
        relevance_score: Number(row.relevanceScore) || 0,
      };
    }),
  );

  return {
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage) || 1,
    },
  };
}

/**
 * Suggest relevant KB articles based on a query string.
 * Used for pre-ticket deflection -- suggest articles that might answer the user's question
 * before they create a support ticket.
 */
export async function suggestArticles(
  tenantId: string,
  query: string,
  limit: number = 5,
): Promise<KBSearchResult[]> {
  const result = await searchArticles(tenantId, query, 1, limit);
  return result.data;
}
