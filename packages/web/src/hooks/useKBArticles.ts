import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type {
  KBCategory,
  KBArticle,
  KBArticleListItem,
  KBSearchResult,
  PaginatedResponse,
  CreateKBCategoryInput,
  UpdateKBCategoryInput,
  CreateKBArticleInput,
  UpdateKBArticleInput,
} from '@busybirdies/shared';

// ---- Query keys ----

/** Query keys for KB data. */
export const kbKeys = {
  categories: ['kb', 'categories'] as const,
  articles: (filters: Record<string, unknown>) => ['kb', 'articles', filters] as const,
  article: (slug: string) => ['kb', 'article', slug] as const,
  search: (q: string, page: number) => ['kb', 'search', q, page] as const,
  suggest: (q: string) => ['kb', 'suggest', q] as const,
};

// ---- Categories ----

/** Fetch all KB categories with article counts. */
export function useKBCategories(portal?: string) {
  return useQuery({
    queryKey: kbKeys.categories,
    queryFn: () => {
      const params = portal ? `?portal=${encodeURIComponent(portal)}` : '';
      return api.get<{ data: KBCategory[] }>(`${ENDPOINTS.kb.categories}${params}`);
    },
  });
}

/** Create a new KB category. */
export function useCreateKBCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKBCategoryInput) =>
      api.post<KBCategory>(ENDPOINTS.kb.categories, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: kbKeys.categories });
    },
  });
}

/** Update an existing KB category. */
export function useUpdateKBCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateKBCategoryInput & { id: string }) =>
      api.patch<KBCategory>(ENDPOINTS.kb.categoryDetail(id), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: kbKeys.categories });
    },
  });
}

/** Delete a KB category. */
export function useDeleteKBCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(ENDPOINTS.kb.categoryDetail(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: kbKeys.categories });
    },
  });
}

// ---- Articles ----

/** Article list filter parameters. */
export interface ArticleListParams {
  category_id?: string;
  status?: string;
  search?: string;
  portal?: string;
  page?: number;
  per_page?: number;
}

/** Fetch a paginated list of KB articles. */
export function useKBArticles(params: ArticleListParams = {}) {
  return useQuery({
    queryKey: kbKeys.articles(params as unknown as Record<string, unknown>),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.category_id) searchParams.set('category_id', params.category_id);
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.portal) searchParams.set('portal', params.portal);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.per_page) searchParams.set('per_page', String(params.per_page));

      const qs = searchParams.toString();
      const url = qs ? `${ENDPOINTS.kb.articles}?${qs}` : ENDPOINTS.kb.articles;

      return api.get<PaginatedResponse<KBArticleListItem>>(url);
    },
  });
}

/** Fetch a single KB article by slug. */
export function useKBArticle(slug: string, portal?: string) {
  return useQuery({
    queryKey: kbKeys.article(slug),
    queryFn: () => {
      const params = portal ? `?portal=${encodeURIComponent(portal)}` : '';
      return api.get<KBArticle>(`${ENDPOINTS.kb.articleBySlug(slug)}${params}`);
    },
    enabled: !!slug,
  });
}

/** Create a new KB article. */
export function useCreateKBArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKBArticleInput) =>
      api.post<KBArticle>(ENDPOINTS.kb.articles, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kb', 'articles'] });
      void queryClient.invalidateQueries({ queryKey: kbKeys.categories });
    },
  });
}

/** Update an existing KB article. */
export function useUpdateKBArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateKBArticleInput & { id: string }) =>
      api.patch<KBArticle>(ENDPOINTS.kb.articleDetail(id), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kb', 'articles'] });
      void queryClient.invalidateQueries({ queryKey: kbKeys.categories });
      // Invalidate the specific article -- we don't know its slug, so invalidate all
      void queryClient.invalidateQueries({ queryKey: ['kb', 'article'] });
    },
  });
}

/** Delete a KB article. */
export function useDeleteKBArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(ENDPOINTS.kb.articleDetail(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kb', 'articles'] });
      void queryClient.invalidateQueries({ queryKey: kbKeys.categories });
    },
  });
}

/** Submit article feedback (helpful yes/no). */
export function useKBArticleFeedback() {
  return useMutation({
    mutationFn: ({ articleId, helpful, portal }: { articleId: string; helpful: boolean; portal?: string }) => {
      const params = portal ? `?portal=${encodeURIComponent(portal)}` : '';
      return api.post<{ message: string }>(`${ENDPOINTS.kb.articleFeedback(articleId)}${params}`, { helpful });
    },
  });
}

// ---- Search ----

/** Search KB articles using full-text search. */
export function useKBSearch(query: string, page: number = 1, perPage: number = 10, portal?: string) {
  return useQuery({
    queryKey: kbKeys.search(query, page),
    queryFn: () => {
      const searchParams = new URLSearchParams({ q: query, page: String(page), per_page: String(perPage) });
      if (portal) searchParams.set('portal', portal);
      return api.get<PaginatedResponse<KBSearchResult>>(`${ENDPOINTS.kb.search}?${searchParams.toString()}`);
    },
    enabled: query.length >= 3,
  });
}

/** Suggest KB articles for pre-ticket deflection. */
export function useKBSuggest(query: string, portal?: string) {
  return useQuery({
    queryKey: kbKeys.suggest(query),
    queryFn: () => {
      const searchParams = new URLSearchParams({ q: query });
      if (portal) searchParams.set('portal', portal);
      return api.get<{ data: KBSearchResult[] }>(`/kb/suggest?${searchParams.toString()}`);
    },
    enabled: query.length >= 3,
  });
}
