import { create } from 'zustand';
import type { User, TenantSummary } from '@supportdesk/shared';

interface AuthState {
  user: User | null;
  tenant: TenantSummary | null;
  isAuthenticated: boolean;
  setAuth: (user: User, tenant: TenantSummary) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  setAuth: (user, tenant) => set({ user, tenant, isAuthenticated: true }),
  clearAuth: () => set({ user: null, tenant: null, isAuthenticated: false }),
}));
