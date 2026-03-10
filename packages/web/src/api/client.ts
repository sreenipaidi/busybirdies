import type { ErrorResponse } from '@busybirdies/shared';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: ErrorResponse['error']['details'];

  constructor(status: number, error: ErrorResponse['error']) {
    super(error.message);
    this.name = 'ApiError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only set Content-Type when there is a body and it's not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  // Handle 401 by redirecting to login
  if (response.status === 401) {
    const currentPath = window.location.pathname;
    if (
      !currentPath.startsWith('/login') &&
      !currentPath.startsWith('/register') &&
      !currentPath.startsWith('/forgot-password') &&
      !currentPath.startsWith('/reset-password')
    ) {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
    throw new ApiError(401, {
      code: 'UNAUTHORIZED',
      message: 'Your session has expired. Please sign in again.',
      request_id: '',
    });
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An unexpected error occurred', request_id: '' },
    })) as ErrorResponse;

    throw new ApiError(response.status, errorBody.error);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => apiClient<T>(endpoint, { method: 'DELETE' }),
};
