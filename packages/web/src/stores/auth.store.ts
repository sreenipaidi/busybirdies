import { create } from 'zustand';
import type { User, TenantSummary } from '@busybirdies/shared';

export interface AuthState {
  user: User | null;
  tenant: TenantSummary | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, tenant: TenantSummary) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, tenant) =>
    set({ user, tenant, isAuthenticated: true, isLoading: false }),
  clearAuth: () =>
    set({ user: null, tenant: null, isAuthenticated: false, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
