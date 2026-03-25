import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketDetailPage } from '../../pages/TicketDetailPage.js';

// Mock window.matchMedia for useMediaQuery hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTicketDetail = {
  ticket: {
    id: 'ticket-1',
    ticket_number: 'TKT-00042',
    subject: 'Cannot access billing portal',
    description: 'When I log in, I see a blank page. I have tried clearing my cache and cookies.',
    priority: 'high',
    status: 'open',
    client: { id: 'c-1', full_name: 'Jane Smith', email: 'jane@acme.com', role: 'client' },
    created_by: { id: 'c-1', full_name: 'Jane Smith', email: 'jane@acme.com', role: 'client' },
    assigned_agent: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
    tags: ['billing', 'login'],
    source: 'portal',
    
    jira_issue_key: null,
    jira_issue_url: null,
    sla_first_response_due: '2026-03-04T15:30:00Z',
    sla_resolution_due: '2026-03-04T22:30:00Z',
    sla_first_response_met: null,
    sla_resolution_met: null,
    first_responded_at: null,
    resolved_at: null,
    closed_at: null,
    created_at: '2026-03-04T14:30:00Z',
    updated_at: '2026-03-04T14:30:00Z',
  },
  replies: [
    {
      id: 'reply-1',
      ticket_id: 'ticket-1',
      user: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
      body: 'Hi Jane, thanks for reporting this. Our billing portal had a brief outage.',
      is_internal: false,
      source: 'agent_ui',
      
      jira_issue_key: null,
      jira_issue_url: null,
      attachments: [],
      created_at: '2026-03-04T15:05:00Z',
    },
    {
      id: 'reply-2',
      ticket_id: 'ticket-1',
      user: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
      body: 'Checked the logs - billing service went down at 1:50 PM.',
      is_internal: true,
      source: 'agent_ui',
      
      jira_issue_key: null,
      jira_issue_url: null,
      attachments: [],
      created_at: '2026-03-04T14:50:00Z',
    },
  ],
  audit_trail: [
    {
      id: 'audit-1',
      ticket_id: 'ticket-1',
      user: null,
      action: 'created',
      field_name: null,
      old_value: null,
      new_value: null,
      metadata: { source: 'portal' },
      created_at: '2026-03-04T14:30:00Z',
    },
  ],
};

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

function renderWithProviders(ticketId: string = 'ticket-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/tickets" element={<div>Tickets List</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching ticket', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderWithProviders();

    expect(screen.getByText('Loading ticket...')).toBeInTheDocument();
  });

  it('renders ticket header with number, status, and priority', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('TKT-00042')).toBeInTheDocument();
    });

    // "Open" appears both as a badge and as a dropdown option; check that at least one exists
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('High').length).toBeGreaterThanOrEqual(1);
  });

  it('renders ticket subject and description', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Cannot access billing portal')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/When I log in, I see a blank page/),
    ).toBeInTheDocument();
  });

  it('renders conversation thread with replies', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText(/Hi Jane, thanks for reporting this/),
      ).toBeInTheDocument();
    });
  });

  it('renders internal notes with visual distinction', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      // "Internal Note" appears as both a badge on the note and as a tab label
      expect(screen.getAllByText('Internal Note').length).toBeGreaterThanOrEqual(2);
      expect(
        screen.getByText(/Checked the logs/),
      ).toBeInTheDocument();
    });
  });

  it('renders sidebar with client info', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      // Jane Smith appears in both the conversation and the sidebar
      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('jane@acme.com')).toBeInTheDocument();
    });
  });

  it('renders tags', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('billing')).toBeInTheDocument();
      expect(screen.getByText('login')).toBeInTheDocument();
    });
  });

  it('renders back to tickets link', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Back to tickets')).toBeInTheDocument();
    });
  });

  it('renders reply editor with reply and internal note tabs', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Reply' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Internal Note' })).toBeInTheDocument();
    });
  });

  it('toggles reply editor between reply and internal note mode', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Reply' })).toBeInTheDocument();
    });

    // Click Internal Note tab
    fireEvent.click(screen.getByRole('tab', { name: 'Internal Note' }));

    // Editor should show internal note placeholder
    expect(
      screen.getByPlaceholderText(/Write an internal note/),
    ).toBeInTheDocument();

    // Button should say "Add Note"
    expect(screen.getByRole('button', { name: /add internal note/i })).toBeInTheDocument();
  });

  it('disables send button when reply body is empty', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send reply/i })).toBeDisabled();
    });
  });

  it('enables send button when reply body has content', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Reply editor')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Reply editor'), 'Test reply content');

    expect(screen.getByRole('button', { name: /send reply/i })).not.toBeDisabled();
  });

  it('shows error state when ticket is not found', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockRejectedValue(new Error('Not found'));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Ticket not found')).toBeInTheDocument();
    });

    expect(screen.getByText('Back to Tickets')).toBeInTheDocument();
  });

  it('renders status and priority dropdowns in sidebar', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Change ticket status')).toBeInTheDocument();
      expect(screen.getByLabelText('Change ticket priority')).toBeInTheDocument();
    });
  });

  it('renders audit trail section', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/Audit Trail/)).toBeInTheDocument();
    });
  });

  it('submits a reply successfully', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.get).mockResolvedValue(mockTicketDetail);
    vi.mocked(api.post).mockResolvedValue({
      id: 'reply-new',
      ticket_id: 'ticket-1',
      user: { id: 'a-1', full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
      body: 'Test reply',
      is_internal: false,
      source: 'agent_ui',
      
      jira_issue_key: null,
      jira_issue_url: null,
      attachments: [],
      created_at: '2026-03-04T16:00:00Z',
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Reply editor')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Reply editor'), 'Test reply');
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });
});
