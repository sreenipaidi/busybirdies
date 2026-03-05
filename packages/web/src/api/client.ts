// TODO: Implement API client
// - Fetch wrapper with credentials: 'include' for cookie auth
// - Automatic error response parsing
// - Request/response interceptors
export const API_BASE_URL = '/v1';

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An unexpected error occurred' },
    }));
    throw error;
  }

  return response.json() as Promise<T>;
}
