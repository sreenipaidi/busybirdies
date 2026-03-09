import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Table, Pagination } from '../../components/ui/Table.js';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Tabs } from '../../components/ui/Tabs.js';
import { usePortalTickets } from '../../hooks/usePortalTickets.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { formatRelative } from '../../lib/format-date.js';
import type { TicketListItem } from '@busybirdies/shared';
import type { PortalTicketFilters } from '../../hooks/usePortalTickets.js';
import type { Column } from '../../components/ui/Table.js';
import type { TicketStatusVariant, PriorityVariant } from '../../components/ui/Badge.js';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

export function PortalTicketsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const filters: PortalTicketFilters = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    sort_by: 'updated_at',
    sort_order: 'desc',
    page,
    per_page: 15,
  };

  const { data, isLoading, isError, error } = usePortalTickets(filters);

  const handleRowClick = useCallback(
    (ticket: TicketListItem) => {
      navigate(`/portal/tickets/${ticket.id}`);
    },
    [navigate],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleStatusTabChange = useCallback((tabId: string) => {
    setStatusFilter(tabId);
    setPage(1);
  }, []);

  const columns: Column<TicketListItem>[] = [
    {
      key: 'ticket_number',
      header: 'Ticket',
      className: 'whitespace-nowrap font-medium text-text-primary',
      render: (ticket) => (
        <span className="text-sm font-medium">{ticket.ticket_number}</span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (ticket) => (
        <div className="max-w-xs lg:max-w-md">
          <p className="text-sm font-medium text-text-primary truncate">
            {ticket.subject}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ticket) => (
        <StatusBadge status={ticket.status as TicketStatusVariant} />
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (ticket) => (
        <PriorityBadge priority={ticket.priority as PriorityVariant} />
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      render: (ticket) => (
        <span className="text-xs text-text-secondary whitespace-nowrap">
          {formatRelative(ticket.updated_at)}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">My Tickets</h1>
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
      </div>

      {/* Tickets card */}
      <Card padding="none">
        {/* Status tabs */}
        <Tabs
          tabs={STATUS_TABS}
          activeTab={statusFilter}
          onTabChange={handleStatusTabChange}
        />

        {/* Search bar */}
        <div className="p-4 border-b border-border">
          <Input
            placeholder="Search by subject or ticket number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search tickets"
          />
        </div>

        {/* Error state */}
        {isError && (
          <div className="p-8 text-center" role="alert">
            <p className="text-danger font-medium mb-2">
              Failed to load tickets
            </p>
            <p className="text-sm text-text-secondary">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !isError && (
          <Table
            columns={columns}
            data={[]}
            keyExtractor={() => ''}
            isLoading
          />
        )}

        {/* Empty state */}
        {!isLoading && !isError && data && data.data.length === 0 && (
          <EmptyState
            title="No tickets found"
            description={
              search || statusFilter
                ? 'Try adjusting your search or filter.'
                : 'You have not submitted any support tickets yet.'
            }
            action={
              !search && !statusFilter
                ? {
                    label: 'Create Ticket',
                    onClick: () => navigate('/portal/tickets/new'),
                  }
                : undefined
            }
          />
        )}

        {/* Data table */}
        {!isLoading && !isError && data && data.data.length > 0 && (
          <>
            <Table
              columns={columns}
              data={data.data}
              keyExtractor={(ticket) => ticket.id}
              onRowClick={handleRowClick}
              emptyMessage="No tickets match your filters."
            />
            {data.pagination.total_pages > 1 && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.total_pages}
                total={data.pagination.total}
                perPage={data.pagination.per_page}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
