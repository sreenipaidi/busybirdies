import type { ArticleStatus } from '../constants/index.js';
import type { UserSummary } from './user.js';
import type { KBCategory } from './kb-category.js';

export interface KBArticle {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: ArticleStatus;
  category: KBCategory;
  author: UserSummary;
  helpful_yes_count: number;
  helpful_no_count: number;
  created_at: string;
  updated_at: string;
}

export interface KBArticleListItem {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  category_name: string;
  author_name: string;
  updated_at: string;
}

export interface KBSearchResult {
  id: string;
  title: string;
  slug: string;
  category_name: string;
  snippet: string;
  relevance_score: number;
}
