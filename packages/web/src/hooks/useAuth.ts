import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth.store.js';
import { api, ApiError } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { User, TenantSummary } from '@supportdesk/shared';

interface AuthResponse {
  user: User;
  tenant: TenantSummary;
}

interface LoginParams {
  email: string;
  password: string;
  portal: string;
}

interface RegisterParams {
  email: string;
  full_name: string;
  password: string;
  company_name: string;
}

interface CreateTenantParams {
  company_name: string;
  subdomain: string;
  admin_email: string;
  admin_full_name: string;
  admin_password: string;
}

export function useAuth() {
  const { user, tenant, isAuthenticated, isLoading, setAuth, clearAuth, setLoading } =
    useAuthStore();
  const navigate = useNavigate();

  // Check auth status on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const data = await api.get<AuthResponse>(ENDPOINTS.auth.me);
        if (!cancelled) {
          setAuth(data.user, data.tenant);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      }
    }

    if (!isAuthenticated) {
      checkAuth();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, []); // Only run on mount

  const login = useCallback(
    async (params: LoginParams) => {
      const data = await api.post<AuthResponse>(ENDPOINTS.auth.login, params);
      setAuth(data.user, data.tenant);

      // Redirect based on role
      if (data.user.role === 'client') {
        navigate('/portal');
      } else {
        navigate('/dashboard');
      }

      return data;
    },
    [setAuth, navigate],
  );

  const register = useCallback(
    async (params: RegisterParams) => {
      const data = await api.post<AuthResponse>(ENDPOINTS.auth.register, params);
      setAuth(data.user, data.tenant);
      navigate('/dashboard');
      return data;
    },
    [setAuth, navigate],
  );

  const createTenant = useCallback(
    async (params: CreateTenantParams) => {
      const data = await api.post<AuthResponse>(ENDPOINTS.tenants.create, params);
      setAuth(data.user, data.tenant);
      navigate('/dashboard');
      return data;
    },
    [setAuth, navigate],
  );

  const logout = useCallback(async () => {
    try {
      await api.post(ENDPOINTS.auth.logout);
    } catch {
      // Logout even if API call fails
    }
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  const forgotPassword = useCallback(async (email: string) => {
    await api.post(ENDPOINTS.auth.forgotPassword, { email });
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      await api.post(ENDPOINTS.auth.resetPassword, { token, password });
      navigate('/login');
    },
    [navigate],
  );

  return {
    user,
    tenant,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
    createTenant,
    forgotPassword,
    resetPassword,
    isAgent: user?.role === 'agent' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    isClient: user?.role === 'client',
    ApiError,
  };
}

