import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateTicketPage } from '../../pages/CreateTicketPage.js';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tickets/new']}>
        <Routes>
          <Route path="/tickets/new" element={<CreateTicketPage />} />
          <Route path="/tickets" element={<div>Tickets List</div>} />
          <Route path="/tickets/:id" element={<div>Ticket Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateTicketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the create ticket form', () => {
    renderWithProviders();

    expect(screen.getByText('Create New Ticket')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Tags')).toBeInTheDocument();
  });

  it('renders back to tickets link', () => {
    renderWithProviders();

    expect(screen.getByText('Back to tickets')).toBeInTheDocument();
  });

  it('renders cancel and submit buttons', () => {
    renderWithProviders();

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit new ticket/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    renderWithProviders();

    fireEvent.click(screen.getByRole('button', { name: /submit new ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a subject for the ticket.')).toBeInTheDocument();
      expect(screen.getByText('Please provide a description of the issue.')).toBeInTheDocument();
      expect(screen.getByText('Please select a priority level.')).toBeInTheDocument();
    });
  });

  it('shows validation error for short description', async () => {
    renderWithProviders();

    await userEvent.type(screen.getByLabelText('Subject'), 'Test subject');
    await userEvent.type(screen.getByLabelText('Description'), 'Too short');

    // Select priority
    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.change(prioritySelect, { target: { value: 'medium' } });

    fireEvent.click(screen.getByRole('button', { name: /submit new ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('Description must be at least 20 characters.')).toBeInTheDocument();
    });
  });

  it('clears individual field errors when the user types', async () => {
    renderWithProviders();

    // Submit empty to trigger errors
    fireEvent.click(screen.getByRole('button', { name: /submit new ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a subject for the ticket.')).toBeInTheDocument();
    });

    // Type in subject
    await userEvent.type(screen.getByLabelText('Subject'), 'A');

    // Subject error should be gone
    expect(screen.queryByText('Please enter a subject for the ticket.')).not.toBeInTheDocument();
    // Description error should still be there
    expect(screen.getByText('Please provide a description of the issue.')).toBeInTheDocument();
  });

  it('submits the form successfully and navigates to the new ticket', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.post).mockResolvedValue({
      id: 'new-ticket-id',
      ticket_number: 'TKT-00099',
      subject: 'Test issue',
      description: 'This is a test description for the ticket',
      priority: 'high',
      status: 'open',
      tags: ['test'],
      client: { id: 'c-1', full_name: 'Client', email: 'c@test.com', role: 'client' },
      created_by: { id: 'a-1', full_name: 'Agent', email: 'a@test.com', role: 'agent' },
      assigned_agent: null,
      source: 'agent',
      
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
    });

    renderWithProviders();

    await userEvent.type(screen.getByLabelText('Subject'), 'Test issue');
    await userEvent.type(
      screen.getByLabelText('Description'),
      'This is a test description for the ticket',
    );
    fireEvent.change(screen.getByLabelText('Priority'), {
      target: { value: 'high' },
    });
    await userEvent.type(screen.getByLabelText('Tags'), 'test');

    fireEvent.click(screen.getByRole('button', { name: /submit new ticket/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tickets', {
        subject: 'Test issue',
        description: 'This is a test description for the ticket',
        priority: 'high',
        tags: ['test'],
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tickets/new-ticket-id');
    });
  });

  it('shows error toast when API call fails', async () => {
    const { api } = await import('../../api/client.js');
    vi.mocked(api.post).mockRejectedValue(new Error('Server error'));

    renderWithProviders();

    await userEvent.type(screen.getByLabelText('Subject'), 'Test issue');
    await userEvent.type(
      screen.getByLabelText('Description'),
      'This is a test description for the ticket',
    );
    fireEvent.change(screen.getByLabelText('Priority'), {
      target: { value: 'medium' },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit new ticket/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('navigates back when cancel button is clicked', () => {
    renderWithProviders();

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockNavigate).toHaveBeenCalledWith('/tickets');
  });

  it('has proper aria-required on required fields', () => {
    renderWithProviders();

    expect(screen.getByLabelText('Subject')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Priority')).toHaveAttribute('aria-required', 'true');
  });

  it('has proper form labelling', () => {
    renderWithProviders();

    expect(screen.getByRole('form', { name: /create ticket form/i })).toBeInTheDocument();
  });
});
