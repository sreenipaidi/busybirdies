import type { UserRole } from '../constants/roles.js';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}
