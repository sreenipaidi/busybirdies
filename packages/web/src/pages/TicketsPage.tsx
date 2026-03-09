import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Table, Pagination } from '../components/ui/Table.js';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useTickets } from '../hooks/useTickets.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatRelative } from '../lib/format-date.js';
import { formatSLATimeRemaining, getSLAStatus } from '../lib/format-sla.js';
import { cn } from '../lib/cn.js';
import type { TicketListItem } from '@busybirdies/shared';
import type { TicketFilters } from '../hooks/useTickets.js';
import type { Column } from '../components/ui/Table.js';
import type { TicketStatusVariant, PriorityVariant } from '../components/ui/Badge.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const SORT_OPTIONS = [
  { value: 'updated_at', label: 'Recently Updated' },
  { value: 'created_at', label: 'Recently Created' },
  { value: 'priority', label: 'Priority' },
];

export function TicketsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const filters: TicketFilters = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    sort_by: sortBy,
    sort_order: sortBy === 'priority' ? 'desc' : 'desc',
    page,
    per_page: 25,
  };

  const { data, isLoading, isError, error } = useTickets(filters);

  // Stats queries
  const { data: openData } = useTickets({ status: 'open', per_page: 1 });
  const { data: pendingData } = useTickets({ status: 'pending', per_page: 1 });
  const { data: resolvedData } = useTickets({ status: 'resolved', per_page: 1 });

  const stats = [
    {
      label: 'Open Tickets',
      value: openData?.pagination.total ?? '--',
      variant: 'primary' as const,
    },
    {
      label: 'Pending',
      value: pendingData?.pagination.total ?? '--',
      variant: 'warning' as const,
    },
    {
      label: 'Resolved',
      value: resolvedData?.pagination.total ?? '--',
      variant: 'success' as const,
    },
    {
      label: 'SLA Breaches',
      value: 0,
      variant: 'danger' as const,
    },
  ];

  const handleRowClick = useCallback(
    (ticket: TicketListItem) => {
      navigate(`/tickets/${ticket.id}`);
    },
    [navigate],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const columns: Column<TicketListItem>[] = [
    {
      key: 'ticket_number',
      header: 'Ticket',
      sortable: true,
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
      key: 'client',
      header: 'Client',
      render: (ticket) => (
        <span className="text-sm text-text-secondary whitespace-nowrap">
          {ticket.client.full_name}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (ticket) => (
        <PriorityBadge priority={ticket.priority as PriorityVariant} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (ticket) => (
        <StatusBadge status={ticket.status as TicketStatusVariant} />
      ),
    },
    {
      key: 'assigned_agent',
      header: 'Assigned',
      render: (ticket) => (
        <span className="text-sm text-text-secondary whitespace-nowrap">
          {ticket.assigned_agent?.full_name ?? (
            <span className="text-warning italic">Unassigned</span>
          )}
        </span>
      ),
    },
    {
      key: 'sla',
      header: 'SLA',
      render: (ticket) => {
        if (!ticket.sla_first_response_due || ticket.sla_first_response_met) {
          return <span className="text-xs text-text-secondary">--</span>;
        }
        const slaStatus = getSLAStatus(ticket.sla_first_response_due);
        return (
          <span
            className={cn(
              'text-xs font-medium whitespace-nowrap',
              slaStatus === 'on-track' && 'text-text-secondary',
              slaStatus === 'warning' && 'text-warning',
              slaStatus === 'breached' && 'text-danger font-bold',
            )}
          >
            {formatSLATimeRemaining(ticket.sla_first_response_due)}
          </span>
        );
      },
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      render: (ticket) => (
        <span className="text-xs text-text-secondary whitespace-nowrap">
          {formatRelative(ticket.updated_at)}
        </span>
      ),
    },
  ];

  const variantColors = {
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    danger: 'text-danger',
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Tickets</h1>
        <Button
          onClick={() => navigate('/tickets/new')}
          aria-label="Create new ticket"
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
          New Ticket
        </Button>
      </div>

      {/* Stats Row */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        role="region"
        aria-label="Ticket statistics"
      >
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {stat.label}
            </p>
            <p
              className={cn(
                'text-2xl font-bold mt-1',
                variantColors[stat.variant],
              )}
            >
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card padding="none" className="mb-6">
        <div className="p-4 border-b border-border">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by subject, ticket number, or client..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search tickets"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-36">
                <Select
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by status"
                />
              </div>
              <div className="w-36">
                <Select
                  options={PRIORITY_OPTIONS}
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by priority"
                />
              </div>
              <div className="w-44">
                <Select
                  options={SORT_OPTIONS}
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Sort tickets"
                />
              </div>
            </div>
          </div>
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
              search || statusFilter || priorityFilter
                ? 'Try adjusting your filters or search query.'
                : 'No tickets have been created yet. Create a ticket to get started.'
            }
            action={
              !search && !statusFilter && !priorityFilter
                ? {
                    label: 'Create Ticket',
                    onClick: () => navigate('/tickets/new'),
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
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.total_pages}
              total={data.pagination.total}
              perPage={data.pagination.per_page}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </Card>
    </div>
  );
}
