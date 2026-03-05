import { useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { usePortalTickets, usePortalStats } from '../../hooks/usePortalTickets.js';
import { formatRelative } from '../../lib/format-date.js';
import { cn } from '../../lib/cn.js';
import type { TicketListItem } from '@supportdesk/shared';
import type { TicketStatusVariant, PriorityVariant } from '../../components/ui/Badge.js';

export function PortalDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const stats = usePortalStats();
  const {
    data: recentData,
    isLoading: recentLoading,
    isError: recentError,
    error: recentErrorObj,
  } = usePortalTickets({
    sort_by: 'updated_at',
    sort_order: 'desc',
    per_page: 5,
  });

  const handleTicketClick = useCallback(
    (ticket: TicketListItem) => {
      navigate(`/portal/tickets/${ticket.id}`);
    },
    [navigate],
  );

  return (
    <div>
      {/* Welcome section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {user?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Here is an overview of your support tickets.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate('/portal/tickets/new')}
            aria-label="Create a new support ticket"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Create Ticket
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/portal/kb')}
            aria-label="Browse knowledge base"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            Knowledge Base
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
        role="region"
        aria-label="Ticket statistics"
      >
        <Card padding="md">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Open Tickets
          </p>
          <p className={cn('text-2xl font-bold mt-1', stats.isLoading ? 'text-text-secondary' : 'text-primary')}>
            {stats.isLoading ? '--' : stats.open}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Pending Response
          </p>
          <p className={cn('text-2xl font-bold mt-1', stats.isLoading ? 'text-text-secondary' : 'text-warning')}>
            {stats.isLoading ? '--' : stats.pending}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Resolved
          </p>
          <p className={cn('text-2xl font-bold mt-1', stats.isLoading ? 'text-text-secondary' : 'text-success')}>
            {stats.isLoading ? '--' : stats.resolved}
          </p>
        </Card>
      </div>

      {/* Recent tickets */}
      <Card padding="none">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Recent Tickets
          </h2>
          <Link
            to="/portal/tickets"
            className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            View all tickets
          </Link>
        </div>

        {/* Loading state */}
        {recentLoading && (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading tickets">
            <Spinner size="md" />
            <span className="sr-only">Loading recent tickets</span>
          </div>
        )}

        {/* Error state */}
        {recentError && (
          <div className="p-8 text-center" role="alert">
            <p className="text-danger font-medium mb-2">
              Failed to load tickets
            </p>
            <p className="text-sm text-text-secondary">
              {recentErrorObj instanceof Error
                ? recentErrorObj.message
                : 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!recentLoading && !recentError && recentData && recentData.data.length === 0 && (
          <EmptyState
            title="No tickets yet"
            description="You have not submitted any support tickets. Create your first ticket or browse our knowledge base for help."
            action={{
              label: 'Create Ticket',
              onClick: () => navigate('/portal/tickets/new'),
            }}
          />
        )}

        {/* Ticket list */}
        {!recentLoading && !recentError && recentData && recentData.data.length > 0 && (
          <div role="list" aria-label="Recent tickets">
            {recentData.data.map((ticket) => (
              <div
                key={ticket.id}
                role="listitem"
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-alt cursor-pointer transition-colors"
                onClick={() => handleTicketClick(ticket)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTicketClick(ticket);
                  }
                }}
                tabIndex={0}
                aria-label={`Ticket ${ticket.ticket_number}: ${ticket.subject}, status ${ticket.status}, priority ${ticket.priority}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary">
                      {ticket.ticket_number}
                    </span>
                    <StatusBadge status={ticket.status as TicketStatusVariant} />
                    <PriorityBadge priority={ticket.priority as PriorityVariant} />
                  </div>
                  <p className="text-sm text-text-primary mt-0.5 truncate">
                    {ticket.subject}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary flex-shrink-0">
                  <span>{formatRelative(ticket.updated_at)}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 hidden sm:block"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
