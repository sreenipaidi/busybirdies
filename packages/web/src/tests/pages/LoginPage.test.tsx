import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../../pages/LoginPage.js';
import { useAuthStore } from '../../stores/auth.store.js';

// Mock useAuth hook
const mockLogin = vi.fn();
const mockLogout = vi.fn();
vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: mockLogout,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    register: vi.fn(),
    isAgent: false,
    isAdmin: false,
    isClient: false,
    ApiError: class extends Error { code = 'TEST'; status = 400; },
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('renders the login form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Welcome to BusyBirdies')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders Google SSO button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('renders register link', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    renderWithProviders(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });
  });

  it('shows email validation error for invalid email', async () => {
    renderWithProviders(<LoginPage />);
    const emailInput = screen.getByLabelText('Email address');
    await userEvent.type(emailInput, 'invalid-email');
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });
  });

  it('calls login on valid form submission', async () => {
    mockLogin.mockResolvedValueOnce({ user: {}, tenant: {} });
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email address'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows server error on login failure', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockLogin.mockRejectedValueOnce(
      new ApiError(401, { code: 'AUTH_FAILED', message: 'Invalid email or password.', request_id: '' }),
    );
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email address'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpassword');
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });
});
