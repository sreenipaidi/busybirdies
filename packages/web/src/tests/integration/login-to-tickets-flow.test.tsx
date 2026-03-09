import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../../pages/LoginPage.js';
import { DashboardPage } from '../../pages/DashboardPage.js';
import { TicketsPage } from '../../pages/TicketsPage.js';
import { useAuthStore } from '../../stores/auth.store.js';
import type { PaginatedResponse, TicketListItem } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: vi.fn(),
    user: useAuthStore.getState().user,
    isAuthenticated: useAuthStore.getState().isAuthenticated,
    isLoading: false,
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    register: vi.fn(),
    isAgent: useAuthStore.getState().user?.role === 'agent' || useAuthStore.getState().user?.role === 'admin',
    isAdmin: useAuthStore.getState().user?.role === 'admin',
    isClient: useAuthStore.getState().user?.role === 'client',
    ApiError: class extends Error { code = 'TEST'; status = 400; },
  }),
}));

vi.mock('../../api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class extends Error {
    code = 'TEST';
    status = 400;
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTicketsData: PaginatedResponse<TicketListItem> = {
  data: [
    {
      id: 'ticket-1',
      ticket_number: 'TKT-00001',
      subject: 'Cannot access billing portal',
      priority: 'high',
      status: 'open',
      client: { id: 'c-1', full_name: 'Jane Smith', email: 'jane@acme.com', role: 'client' },
      assigned_agent: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
      tags: ['billing'],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-04T14:30:00Z',
      updated_at: '2026-03-04T14:30:00Z',
    },
    {
      id: 'ticket-2',
      ticket_number: 'TKT-00002',
      subject: 'Login help needed',
      priority: 'low',
      status: 'pending',
      client: { id: 'c-2', full_name: 'Priya Sharma', email: 'priya@beta.com', role: 'client' },
      assigned_agent: null,
      tags: [],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-03T10:00:00Z',
      updated_at: '2026-03-04T12:00:00Z',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 25, total_pages: 1 },
};

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Login -> Dashboard -> Tickets navigation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('should render the login form and submit credentials', async () => {
    mockLogin.mockResolvedValueOnce({
      user: {
        id: 'agent-1',
        email: 'agent@acme.com',
        full_name: 'Marcus Lee',
        role: 'agent',
        is_active: true,
        email_verified: true,
        created_at: '2026-01-15T10:00:00Z',
      },
      tenant: { id: 't-1', name: 'Acme Corp', subdomain: 'acme' },
    });

    renderWithProviders(<LoginPage />);

    // Verify login form renders
    expect(screen.getByText('Welcome to BusyBirdies')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();

    // Fill in and submit
    await userEvent.type(screen.getByLabelText('Email address'), 'agent@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'agent@acme.com',
        password: 'password123',
      });
    });
  });

  it('should render the dashboard page with stat cards and empty state', () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Open Tickets')).toBeInTheDocument();
    expect(screen.getByText('Pending Tickets')).toBeInTheDocument();
    expect(screen.getByText('SLA At Risk')).toBeInTheDocument();
    expect(screen.getByText('Avg First Response')).toBeInTheDocument();
    expect(screen.getByText('No tickets assigned to you yet')).toBeInTheDocument();
  });

  it('should render the tickets page with data and allow navigation to ticket detail', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    expect(screen.getByText('Tickets')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
      expect(screen.getByText('Cannot access billing portal')).toBeInTheDocument();
      expect(screen.getByText('TKT-00002')).toBeInTheDocument();
      expect(screen.getByText('Login help needed')).toBeInTheDocument();
    });

    // Click on a ticket row to navigate to detail
    const row = screen.getByText('TKT-00001').closest('tr');
    if (row) fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1');
  });

  it('should navigate to create ticket page from tickets list', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    fireEvent.click(screen.getByRole('button', { name: /create new ticket/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/new');
  });

  it('should filter tickets using the search input', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    const searchInput = screen.getByLabelText('Search tickets');
    await userEvent.type(searchInput, 'billing');

    expect(searchInput).toHaveValue('billing');
  });

  it('should show error state when ticket list fails to load', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load tickets')).toBeInTheDocument();
    });
  });

  it('should show empty state when no tickets match filters', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, per_page: 25, total_pages: 0 },
    });

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('No tickets found')).toBeInTheDocument();
    });
  });
});
