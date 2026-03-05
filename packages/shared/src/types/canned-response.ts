import type { UserSummary } from './user.js';

export interface CannedResponse {
  id: string;
  title: string;
  body: string;
  category: string | null;
  created_by: UserSummary;
  created_at: string;
  updated_at: string;
}
