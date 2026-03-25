import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalCreateTicketPage } from '../../pages/portal/PortalCreateTicketPage.js';
import { PortalDashboardPage } from '../../pages/portal/PortalDashboardPage.js';
import { PortalTicketsPage } from '../../pages/portal/PortalTicketsPage.js';
import type { PaginatedResponse, TicketListItem, KBSearchResult, Ticket } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'ticket-portal-001' }),
  };
});

const mockAddToast = vi.fn();
vi.mock('../../stores/ui.store.js', () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
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

const clientSummary = {
  id: 'client-001',
  full_name: 'Priya Sharma',
  email: 'priya@client.com',
  role: 'client' as const,
};

const mockKBResults: PaginatedResponse<KBSearchResult> = {
  data: [
    {
      id: 'kb-1',
      title: 'How to Reset Your Password',
      slug: 'how-to-reset-your-password',
      category_name: 'Getting Started',
      snippet: 'To reset your password, go to the login page...',
      relevance_score: 0.9,
    },
  ],
  pagination: { total: 1, page: 1, per_page: 3, total_pages: 1 },
};

const mockCreatedTicket: Ticket = {
  id: 'ticket-portal-001',
  ticket_number: 'TKT-00042',
  subject: 'Cannot access dashboard after login',
  description: 'When I log in I see a blank white page with no content loaded at all.',
  priority: 'medium',
  status: 'open',
  client: clientSummary,
  created_by: clientSummary,
  assigned_agent: null,
  tags: [],
  source: 'portal',
  
  jira_issue_key: null,
  jira_issue_url: null,
  sla_first_response_due: null,
  sla_resolution_due: null,
  sla_first_response_met: null,
  sla_resolution_met: null,
  first_responded_at: null,
  resolved_at: null,
  closed_at: null,
  created_at: '2026-03-04T14:30:00Z',
  updated_at: '2026-03-04T14:30:00Z',
};

const mockPortalTickets: PaginatedResponse<TicketListItem> = {
  data: [
    {
      id: 'ticket-portal-001',
      ticket_number: 'TKT-00042',
      subject: 'Cannot access dashboard after login',
      priority: 'medium',
      status: 'open',
      client: clientSummary,
      assigned_agent: null,
      tags: [],
      sla_first_response_due: null,
      sla_first_response_met: null,
      created_at: '2026-03-04T14:30:00Z',
      updated_at: '2026-03-04T14:30:00Z',
    },
  ],
  pagination: { total: 1, page: 1, per_page: 25, total_pages: 1 },
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

// ---------------------------------------------------------------------------
// Tests: Portal flow
// ---------------------------------------------------------------------------

describe('Integration: Portal - KB deflection -> create ticket -> see in list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show KB deflection suggestions, then allow ticket submission when not helpful', async () => {
    const { api } = await import('../../api/client.js');

    // KB search returns results
    vi.mocked(api.get).mockResolvedValue(mockKBResults);

    renderWithProviders(<PortalCreateTicketPage />);

    // Step 1: Page shows the KB deflection phase
    expect(screen.getByText('Before submitting a ticket')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search knowledge base for answers');
    await userEvent.type(searchInput, 'dashboard access');

    // Step 2: KB articles appear
    await waitFor(() => {
      expect(screen.getByText('How to Reset Your Password')).toBeInTheDocument();
    });

    // Step 3: User clicks "No, I still need help"
    fireEvent.click(screen.getByText('No, I still need help'));

    // Step 4: Form appears with subject pre-filled from search
    expect(screen.getByLabelText('Subject')).toHaveValue('dashboard access');
  });

  it('should deflect user back to portal when KB article is helpful', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockKBResults);

    renderWithProviders(<PortalCreateTicketPage />);

    const searchInput = screen.getByLabelText('Search knowledge base for answers');
    await userEvent.type(searchInput, 'password reset');

    await waitFor(() => {
      expect(screen.getByText('Yes, that helped')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Yes, that helped'));
    expect(mockNavigate).toHaveBeenCalledWith('/portal');
  });

  it('should create a ticket and navigate to the detail page on success', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.post).mockResolvedValue(mockCreatedTicket);

    renderWithProviders(<PortalCreateTicketPage />);

    // Skip KB deflection
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    // Fill in the form
    await userEvent.type(screen.getByLabelText('Subject'), 'Cannot access dashboard after login');
    await userEvent.type(
      screen.getByLabelText('Description'),
      'When I log in I see a blank white page with no content loaded at all.',
    );

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Ticket TKT-00042 submitted successfully.',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/ticket-portal-001');
    });
  });

  it('should show validation errors when form is submitted with missing data', async () => {
    renderWithProviders(<PortalCreateTicketPage />);

    // Skip KB deflection
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a subject for your ticket.')).toBeInTheDocument();
    });
  });

  it('should show error toast when ticket submission fails', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.post).mockRejectedValue(new Error('Server error'));

    renderWithProviders(<PortalCreateTicketPage />);

    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    await userEvent.type(screen.getByLabelText('Subject'), 'Test ticket subject');
    await userEvent.type(
      screen.getByLabelText('Description'),
      'This is a detailed description that meets the minimum character requirement.',
    );

    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'We could not submit your ticket. Please try again.',
      });
    });
  });

  it('should display portal dashboard with ticket list', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockPortalTickets);

    renderWithProviders(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00042')).toBeInTheDocument();
      expect(screen.getByText('Cannot access dashboard after login')).toBeInTheDocument();
    });
  });

  it('should render the portal tickets list and navigate to detail on click', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockPortalTickets);

    renderWithProviders(<PortalTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00042')).toBeInTheDocument();
    });

    // Click on the ticket row
    const row = screen.getByText('TKT-00042').closest('tr');
    if (row) fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/ticket-portal-001');
  });

  it('should not allow clients to set urgent priority', async () => {
    renderWithProviders(<PortalCreateTicketPage />);

    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    const prioritySelect = screen.getByLabelText('Select ticket priority');
    const options = Array.from(prioritySelect.querySelectorAll('option'));
    const values = options.map((o) => o.value);

    expect(values).toContain('low');
    expect(values).toContain('medium');
    expect(values).toContain('high');
    expect(values).not.toContain('urgent');
  });
});
