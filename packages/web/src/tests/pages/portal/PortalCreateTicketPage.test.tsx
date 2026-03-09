import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalCreateTicketPage } from '../../../pages/portal/PortalCreateTicketPage.js';
import type { PaginatedResponse, KBSearchResult, Ticket } from '@busybirdies/shared';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock UI store
const mockAddToast = vi.fn();
vi.mock('../../../stores/ui.store.js', () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

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
  id: 'ticket-new',
  ticket_number: 'TKT-00042',
  subject: 'Test subject',
  description: 'This is a test description that is longer than 20 chars.',
  priority: 'medium',
  status: 'open',
  client: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
  created_by: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
  assigned_agent: null,
  tags: [],
  source: 'portal',
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

describe('PortalCreateTicketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    renderWithProviders(<PortalCreateTicketPage />);
    expect(screen.getByText('Submit a Support Ticket')).toBeInTheDocument();
  });

  it('renders KB suggestion phase first', () => {
    renderWithProviders(<PortalCreateTicketPage />);

    expect(screen.getByText('Before submitting a ticket')).toBeInTheDocument();
    expect(screen.getByLabelText('Search knowledge base for answers')).toBeInTheDocument();
    expect(screen.getByText('Skip, submit a ticket')).toBeInTheDocument();
  });

  it('shows form when skip is clicked', async () => {
    renderWithProviders(<PortalCreateTicketPage />);

    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Select ticket priority')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit support ticket/i })).toBeInTheDocument();
  });

  it('renders back link', () => {
    renderWithProviders(<PortalCreateTicketPage />);
    expect(screen.getByText('Back to dashboard')).toBeInTheDocument();
  });

  it('shows KB suggestions when query is typed', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockKBResults);

    renderWithProviders(<PortalCreateTicketPage />);

    const searchInput = screen.getByLabelText('Search knowledge base for answers');
    await userEvent.type(searchInput, 'password reset');

    await waitFor(() => {
      expect(screen.getByText('Did you find what you need?')).toBeInTheDocument();
      expect(screen.getByText('How to Reset Your Password')).toBeInTheDocument();
    });
  });

  it('navigates to dashboard when "Yes, that helped" is clicked', async () => {
    const { api } = await import('../../../api/client.js');
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

  it('shows the form when "No, I still need help" is clicked', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockKBResults);

    renderWithProviders(<PortalCreateTicketPage />);

    const searchInput = screen.getByLabelText('Search knowledge base for answers');
    await userEvent.type(searchInput, 'password reset');

    await waitFor(() => {
      expect(screen.getByText('No, I still need help')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('No, I still need help'));

    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
  });

  it('validates empty subject on submit', async () => {
    renderWithProviders(<PortalCreateTicketPage />);
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a subject for your ticket.')).toBeInTheDocument();
    });
  });

  it('validates short description on submit', async () => {
    renderWithProviders(<PortalCreateTicketPage />);
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    await userEvent.type(screen.getByLabelText('Subject'), 'Test subject');
    await userEvent.type(screen.getByLabelText('Description'), 'Too short');

    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('Please provide at least 20 characters describing your issue.')).toBeInTheDocument();
    });
  });

  it('submits ticket successfully', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.post).mockResolvedValue(mockCreatedTicket);

    renderWithProviders(<PortalCreateTicketPage />);
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    await userEvent.type(screen.getByLabelText('Subject'), 'Test subject');
    await userEvent.type(
      screen.getByLabelText('Description'),
      'This is a test description that is longer than twenty characters.',
    );

    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Ticket TKT-00042 submitted successfully.',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/portal/tickets/ticket-new');
    });
  });

  it('shows error toast when submission fails', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.post).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<PortalCreateTicketPage />);
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    await userEvent.type(screen.getByLabelText('Subject'), 'Test subject');
    await userEvent.type(
      screen.getByLabelText('Description'),
      'This is a detailed description that is long enough to pass validation checks.',
    );

    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'We could not submit your ticket. Please try again.',
      });
    });
  });

  it('renders cancel button that navigates back', async () => {
    renderWithProviders(<PortalCreateTicketPage />);
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/portal');
  });

  it('has correct priority options', async () => {
    renderWithProviders(<PortalCreateTicketPage />);
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    const prioritySelect = screen.getByLabelText('Select ticket priority');
    expect(prioritySelect).toBeInTheDocument();

    // Should not have 'Urgent' option (clients cannot set urgent)
    const options = Array.from(prioritySelect.querySelectorAll('option'));
    const optionValues = options.map((o) => o.value);
    expect(optionValues).toContain('low');
    expect(optionValues).toContain('medium');
    expect(optionValues).toContain('high');
    expect(optionValues).not.toContain('urgent');
  });

  it('prefills subject from KB search when moving to form', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue({ data: [], pagination: { total: 0, page: 1, per_page: 3, total_pages: 0 } });

    renderWithProviders(<PortalCreateTicketPage />);

    const searchInput = screen.getByLabelText('Search knowledge base for answers');
    await userEvent.type(searchInput, 'dashboard access issue');

    // Click skip to go to form
    fireEvent.click(screen.getByText('Skip, submit a ticket'));

    expect(screen.getByLabelText('Subject')).toHaveValue('dashboard access issue');
  });
});
