import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalTicketDetailPage } from '../../../pages/portal/PortalTicketDetailPage.js';
import type { Ticket, TicketReply } from '@busybirdies/shared';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

const mockTicket: Ticket = {
  id: 'ticket-1',
  ticket_number: 'TKT-00042',
  subject: 'Cannot access my dashboard',
  description: 'When I log in, I see a blank page instead of my dashboard.',
  priority: 'high',
  status: 'open',
  client: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
  created_by: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
  assigned_agent: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
  tags: ['dashboard', 'login'],
  source: 'portal',
  sla_first_response_due: '2026-03-04T15:30:00Z',
  sla_resolution_due: '2026-03-04T22:30:00Z',
  sla_first_response_met: null,
  sla_resolution_met: null,
  first_responded_at: null,
  resolved_at: null,
  closed_at: null,
  created_at: '2026-03-04T14:30:00Z',
  updated_at: '2026-03-04T14:30:00Z',
};

const mockReplies: TicketReply[] = [
  {
    id: 'reply-1',
    ticket_id: 'ticket-1',
    user: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
    body: 'Hi Priya, we are looking into this issue. Can you try clearing your browser cache?',
    is_internal: false,
    source: 'agent_ui',
    attachments: [],
    created_at: '2026-03-04T15:00:00Z',
  },
];

const mockTicketDetail = {
  ticket: mockTicket,
  replies: mockReplies,
};

const mockClosedTicket = {
  ticket: { ...mockTicket, status: 'closed' as const },
  replies: mockReplies,
};

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ['/portal/tickets/ticket-1']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/portal/tickets/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalTicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<PortalTicketDetailPage />);

    expect(screen.getByRole('status', { name: /loading ticket/i })).toBeInTheDocument();
  });

  it('renders ticket detail when data loads', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00042')).toBeInTheDocument();
      expect(screen.getByText('Cannot access my dashboard')).toBeInTheDocument();
    });
  });

  it('shows ticket description as first message', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('When I log in, I see a blank page instead of my dashboard.')).toBeInTheDocument();
    });
  });

  it('shows replies in conversation thread', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Hi Priya, we are looking into this issue/)).toBeInTheDocument();
      expect(screen.getByText('Marcus Lee')).toBeInTheDocument();
    });
  });

  it('labels agent replies with Support badge', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Support')).toBeInTheDocument();
    });
  });

  it('shows status and priority badges', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });

  it('renders metadata bar with created date and priority', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Created:')).toBeInTheDocument();
      expect(screen.getByText('Last updated:')).toBeInTheDocument();
      expect(screen.getByText('Priority:')).toBeInTheDocument();
    });
  });

  it('renders reply form for open ticket', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Reply editor')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reply/i })).toBeInTheDocument();
    });
  });

  it('disables send button when reply is empty', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send reply/i })).toBeDisabled();
    });
  });

  it('enables send button when reply has content', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Reply editor')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Reply editor'), 'Thank you for the help!');

    expect(screen.getByRole('button', { name: /send reply/i })).not.toBeDisabled();
  });

  it('sends reply successfully', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);
    vi.mocked(api.post).mockResolvedValue({
      id: 'reply-2',
      ticket_id: 'ticket-1',
      user: { id: 'u-1', full_name: 'Priya Sharma', email: 'priya@test.com', role: 'client' },
      body: 'Thank you!',
      is_internal: false,
      source: 'portal',
      attachments: [],
      created_at: '2026-03-04T16:00:00Z',
    });

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Reply editor')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Reply editor'), 'Thank you!');
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Reply sent successfully.',
      });
    });
  });

  it('shows error toast when reply fails', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);
    vi.mocked(api.post).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Reply editor')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Reply editor'), 'Thank you!');
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'Failed to send reply. Your message has been saved. Please try again.',
      });
    });
  });

  it('hides reply form for closed ticket', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockClosedTicket);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('TKT-00042')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Reply editor')).not.toBeInTheDocument();
    expect(screen.getByText(/This ticket is closed/)).toBeInTheDocument();
  });

  it('shows error state when ticket not found', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Not found'));

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Ticket not found')).toBeInTheDocument();
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });
  });

  it('navigates back when Back to Dashboard is clicked on error', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Not found'));

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Back to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/portal');
  });

  it('has conversation thread with correct ARIA role', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('log', { name: /conversation thread/i })).toBeInTheDocument();
    });
  });

  it('renders back link to tickets list', async () => {
    const { api } = await import('../../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders(<PortalTicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to tickets')).toBeInTheDocument();
    });
  });
});
