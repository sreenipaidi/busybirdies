import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalTicketsPage } from '../../../pages/portal/PortalTicketsPage.js';
import type { PaginatedResponse, TicketListItem } from '@busybirdies/shared';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
      subject: 'Cannot access billing portal',
      priority: 'high',
      status: 'open',
      client: { id: 'c-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
      assigned_agent: null,
      tags: [],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-04T14:30:00Z',
      updated_at: '2026-03-04T14:30:00Z',
    },
    {
      id: 'ticket-2',
      ticket_number: 'TKT-00002',
      subject: 'Login help needed',
      priority: 'medium',
      status: 'pending',
      client: { id: 'c-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
      assigned_agent: null,
      tags: [],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-03T10:00:00Z',
      updated_at: '2026-03-04T12:00:00Z',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 15, total_pages: 1 },
};

const emptyTickets: PaginatedResponse<TicketListItem> = {
  data: [],
  pagination: { total: 0, page: 1, per_page: 15, total_pages: 0 },
};

const multiPageTickets: PaginatedResponse<TicketListItem> = {
  data: mockTickets.data,
  pagination: { total: 30, page: 1, per_page: 15, total_pages: 2 },
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

describe('PortalTicketsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and create ticket button', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    expect(screen.getByText('My Tickets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create a new support ticket/i })).toBeInTheDocument();
  });

  it('renders status filter tabs', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Closed' })).toBeInTheDocument();
  });

  it('renders search input', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    expect(screen.getByLabelText('Search tickets')).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<PortalTicketsPage />);

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('displays tickets when data loads', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
      expect(screen.getByText('Cannot access billing portal')).toBeInTheDocument();
      expect(screen.getByText('TKT-00002')).toBeInTheDocument();
      expect(screen.getByText('Login help needed')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tickets found', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(emptyTickets);

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('No tickets found')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Server error'));

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load tickets')).toBeInTheDocument();
    });
  });

  it('navigates to ticket detail on row click', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
    });

    const row = screen.getByText('TKT-00001').closest('tr');
    if (row) fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/ticket-1');
  });

  it('navigates to create ticket page', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    fireEvent.click(screen.getByRole('button', { name: /create a new support ticket/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/new');
  });

  it('renders pagination when multiple pages', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(multiPageTickets);

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('Showing 1-15 of 30')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });
  });

  it('allows searching tickets', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    const searchInput = screen.getByLabelText('Search tickets');
    await userEvent.type(searchInput, 'billing');

    expect(searchInput).toHaveValue('billing');
  });

  it('allows switching status tabs', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    const openTab = screen.getByRole('tab', { name: 'Open' });
    fireEvent.click(openTab);

    expect(openTab).toHaveAttribute('aria-selected', 'true');
  });

  it('displays correct table columns', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTickets);

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ticket')).toBeInTheDocument();
      expect(screen.getByText('Subject')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('Last Updated')).toBeInTheDocument();
    });
  });
});
