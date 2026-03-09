import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalDashboardPage } from '../../../pages/portal/PortalDashboardPage.js';
import type { PaginatedResponse, TicketListItem } from '@busybirdies/shared';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock auth store
vi.mock('../../../stores/auth.store.js', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
      tenant: { id: 't-1', name: 'Acme Corp', subdomain: 'acme' },
      isAuthenticated: true,
      isLoading: false,
    }),
}));

// Mock API
vi.mock('../../../api/client.js', () => ({
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

const mockTickets: PaginatedResponse<TicketListItem> = {
  data: [
    {
      id: 'ticket-1',
      ticket_number: 'TKT-00001',
      subject: 'Cannot access my dashboard',
      priority: 'high',
      status: 'open',
      client: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
      assigned_agent: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
      tags: [],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-04T14:30:00Z',
      updated_at: '2026-03-04T14:30:00Z',
    },
    {
      id: 'ticket-2',
      ticket_number: 'TKT-00002',
      subject: 'Billing question',
      priority: 'medium',
      status: 'pending',
      client: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
      assigned_agent: null,
      tags: [],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-03T10:00:00Z',
      updated_at: '2026-03-04T12:00:00Z',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 5, total_pages: 1 },
};

const emptyTickets: PaginatedResponse<TicketListItem> = {
  data: [],
  pagination: { total: 0, page: 1, per_page: 5, total_pages: 0 },
};

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

describe('PortalDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the welcome message with user first name', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    expect(screen.getByText('Welcome back, Priya')).toBeInTheDocument();
  });

  it('renders quick action buttons', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    expect(screen.getByRole('button', { name: /create a new support ticket/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse knowledge base/i })).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    const statsRegion = screen.getByRole('region', { name: /ticket statistics/i });
    expect(statsRegion).toBeInTheDocument();
    expect(screen.getByText('Open Tickets')).toBeInTheDocument();
    expect(screen.getByText('Pending Response')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders recent tickets section', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    expect(screen.getByText('Recent Tickets')).toBeInTheDocument();
    expect(screen.getByText('View all tickets')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
      expect(screen.getByText('Cannot access my dashboard')).toBeInTheDocument();
      expect(screen.getByText('TKT-00002')).toBeInTheDocument();
      expect(screen.getByText('Billing question')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tickets exist', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(emptyTickets);

    renderWithProviders(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No tickets yet')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load tickets')).toBeInTheDocument();
    });
  });

  it('navigates to ticket detail when clicking a ticket', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
    });

    const ticketItem = screen.getByText('TKT-00001').closest('[role="listitem"]');
    if (ticketItem) fireEvent.click(ticketItem);

    expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/ticket-1');
  });

  it('navigates to create ticket when clicking Create Ticket button', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: /create a new support ticket/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/new');
  });

  it('navigates to knowledge base when clicking KB button', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: /browse knowledge base/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/portal/kb');
  });

  it('supports keyboard navigation on ticket items', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
    });

    const ticketItem = screen.getByText('TKT-00001').closest('[role="listitem"]');
    if (ticketItem) {
      fireEvent.keyDown(ticketItem, { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/ticket-1');
    }
  });
});
