import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketsPage } from '../../pages/TicketsPage.js';
import type { PaginatedResponse, TicketListItem } from '@busybirdies/shared';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
  pagination: {
    total: 2,
    page: 1,
    per_page: 25,
    total_pages: 1,
  },
};

const emptyTicketsData: PaginatedResponse<TicketListItem> = {
  data: [],
  pagination: { total: 0, page: 1, per_page: 25, total_pages: 0 },
};

// Mock the API
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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TicketsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and new ticket button', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new ticket/i })).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    const statsRegion = screen.getByRole('region', { name: /ticket statistics/i });
    expect(statsRegion).toBeInTheDocument();
    expect(screen.getByText('Open Tickets')).toBeInTheDocument();
    expect(screen.getByText('SLA Breaches')).toBeInTheDocument();
    // "Pending" and "Resolved" also appear in filter dropdowns, so check within the stats region
    expect(statsRegion).toHaveTextContent('Pending');
    expect(statsRegion).toHaveTextContent('Resolved');
  });

  it('renders filter controls', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    expect(screen.getByLabelText('Search tickets')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort tickets')).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // never resolves

    renderWithProviders(<TicketsPage />);

    // The skeleton rows are rendered by the Table component
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('shows tickets in the table when data loads', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
      expect(screen.getByText('Cannot access billing portal')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Marcus Lee')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('TKT-00002')).toBeInTheDocument();
      expect(screen.getByText('Login help needed')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tickets match filters', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(emptyTicketsData);

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('No tickets found')).toBeInTheDocument();
    });
  });

  it('navigates to ticket detail when row is clicked', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00001')).toBeInTheDocument();
    });

    // Click the row (the row is the tr containing TKT-00001)
    const row = screen.getByText('TKT-00001').closest('tr');
    if (row) fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1');
  });

  it('navigates to create ticket page when new ticket button is clicked', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    fireEvent.click(screen.getByRole('button', { name: /create new ticket/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/new');
  });

  it('shows error state when API fails', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load tickets')).toBeInTheDocument();
    });
  });

  it('updates search input value', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    const searchInput = screen.getByLabelText('Search tickets');
    await userEvent.type(searchInput, 'billing');

    expect(searchInput).toHaveValue('billing');
  });

  it('shows Unassigned text for unassigned tickets', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketsData);

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });
  });
});
