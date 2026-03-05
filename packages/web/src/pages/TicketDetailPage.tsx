import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { Textarea } from '../components/ui/Input.js';
import { StatusBadge, PriorityBadge, Badge } from '../components/ui/Badge.js';
import { Avatar } from '../components/ui/Avatar.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Tabs, TabPanel } from '../components/ui/Tabs.js';
import { CollisionBanner } from '../components/features/tickets/CollisionBanner.js';
import { MentionInput } from '../components/features/tickets/MentionInput.js';
import { CannedResponsePicker } from '../components/features/tickets/CannedResponsePicker.js';
import { useTicket, useUpdateTicket } from '../hooks/useTicket.js';
import { useCreateReply } from '../hooks/useReplies.js';
import { useCollisionDetection } from '../hooks/useHeartbeat.js';
import { useUIStore } from '../stores/ui.store.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { formatDateTime, formatRelative } from '../lib/format-date.js';
import { formatSLATimeRemaining, getSLAStatus } from '../lib/format-sla.js';
import { cn } from '../lib/cn.js';
import type { TicketReply, AuditEntry } from '@supportdesk/shared';
import type { TicketStatusVariant, PriorityVariant } from '../components/ui/Badge.js';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const { data, isLoading, isError, error } = useTicket(id ?? '');
  const updateTicket = useUpdateTicket(id ?? '');
  const createReply = useCreateReply(id ?? '');
  const { otherViewers, setIsComposing } = useCollisionDetection(id);

  const [replyBody, setReplyBody] = useState('');
  const [replyMode, setReplyMode] = useState<'reply' | 'internal'>('reply');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);

  // Update composing state when the user starts/stops typing
  useEffect(() => {
    setIsComposing(replyBody.trim().length > 0);
  }, [replyBody, setIsComposing]);

  const ticket = data?.ticket;
  const replies = data?.replies ?? [];
  const auditTrail = data?.audit_trail ?? [];

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      try {
        await updateTicket.mutateAsync({ status: newStatus });
        addToast({ type: 'success', message: `Status changed to ${newStatus}.` });
      } catch {
        addToast({ type: 'error', message: 'Failed to update status. Please try again.' });
      }
    },
    [updateTicket, addToast],
  );

  const handlePriorityChange = useCallback(
    async (newPriority: string) => {
      try {
        await updateTicket.mutateAsync({ priority: newPriority });
        addToast({ type: 'success', message: `Priority changed to ${newPriority}.` });
      } catch {
        addToast({ type: 'error', message: 'Failed to update priority. Please try again.' });
      }
    },
    [updateTicket, addToast],
  );

  const handleSendReply = useCallback(async () => {
    if (!replyBody.trim()) return;

    try {
      await createReply.mutateAsync({
        body: replyBody.trim(),
        is_internal: replyMode === 'internal',
      });
      setReplyBody('');
      addToast({
        type: 'success',
        message: replyMode === 'internal' ? 'Internal note added.' : 'Reply sent successfully.',
      });
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to send reply. Your message has been saved as a draft. Please try again.',
      });
    }
  }, [replyBody, replyMode, createReply, addToast]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading ticket">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-text-secondary">Loading ticket...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]" role="alert">
        <svg
          className="h-16 w-16 text-gray-300 mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Ticket not found
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          {error instanceof Error
            ? error.message
            : 'It may have been deleted or you may not have access.'}
        </p>
        <Button variant="secondary" onClick={() => navigate('/tickets')}>
          Back to Tickets
        </Button>
      </div>
    );
  }

  const replyTabs = [
    { id: 'reply', label: 'Reply' },
    { id: 'internal', label: 'Internal Note' },
  ];

  const sidebarContent = (
    <div className="space-y-6">
      {/* Status */}
      <div>
        <label
          htmlFor="ticket-status"
          className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1"
        >
          Status
        </label>
        <Select
          id="ticket-status"
          options={STATUS_OPTIONS}
          value={ticket.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          aria-label="Change ticket status"
        />
      </div>

      {/* Priority */}
      <div>
        <label
          htmlFor="ticket-priority"
          className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1"
        >
          Priority
        </label>
        <Select
          id="ticket-priority"
          options={PRIORITY_OPTIONS}
          value={ticket.priority}
          onChange={(e) => handlePriorityChange(e.target.value)}
          aria-label="Change ticket priority"
        />
      </div>

      {/* Assigned Agent */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Assigned To
        </p>
        <p className="text-sm text-text-primary">
          {ticket.assigned_agent?.full_name ?? (
            <span className="text-warning italic">Unassigned</span>
          )}
        </p>
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Tags
        </p>
        <div className="flex flex-wrap gap-1">
          {ticket.tags.length === 0 && (
            <span className="text-sm text-text-secondary italic">No tags</span>
          )}
          {ticket.tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* SLA */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          SLA
        </p>
        <div className="space-y-2">
          <SLATimer
            label="First Response"
            dueDate={ticket.sla_first_response_due}
            met={ticket.sla_first_response_met}
          />
          <SLATimer
            label="Resolution"
            dueDate={ticket.sla_resolution_due}
            met={ticket.sla_resolution_met}
          />
        </div>
      </div>

      {/* Client Info */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Client
        </p>
        <div className="flex items-center gap-2">
          <Avatar name={ticket.client.full_name} size="sm" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {ticket.client.full_name}
            </p>
            <p className="text-xs text-text-secondary">{ticket.client.email}</p>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Created
        </p>
        <p className="text-sm text-text-secondary">
          {formatDateTime(ticket.created_at)}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Last Updated
        </p>
        <p className="text-sm text-text-secondary">
          {formatDateTime(ticket.updated_at)}
        </p>
      </div>

      {/* Audit Trail */}
      {auditTrail.length > 0 && (
        <div>
          <button
            onClick={() => setAuditExpanded(!auditExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 hover:text-text-primary transition-colors w-full text-left"
            aria-expanded={auditExpanded}
            aria-controls="audit-trail-panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={cn(
                'h-3 w-3 transition-transform',
                auditExpanded && 'rotate-90',
              )}
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
            Audit Trail ({auditTrail.length})
          </button>
          {auditExpanded && (
            <div
              id="audit-trail-panel"
              className="space-y-2 max-h-60 overflow-y-auto"
              role="region"
              aria-label="Audit trail"
            >
              {auditTrail.map((entry) => (
                <AuditEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Collision detection banner */}
      <CollisionBanner viewers={otherViewers} />

      {/* Back link and header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors"
          aria-label="Back to tickets list"
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
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back to tickets
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-xl font-bold text-text-primary">
            {ticket.ticket_number}
          </h1>
          <StatusBadge status={ticket.status as TicketStatusVariant} />
          <PriorityBadge priority={ticket.priority as PriorityVariant} />
        </div>

        {/* Mobile sidebar toggle */}
        {isMobile && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-expanded={sidebarOpen}
            aria-controls="ticket-sidebar"
          >
            {sidebarOpen ? 'Hide Details' : 'Show Details'}
          </Button>
        )}
      </div>

      {/* Subject and meta */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          {ticket.subject}
        </h2>
        <p className="text-sm text-text-secondary">
          Created by {ticket.created_by.full_name} on{' '}
          {formatDateTime(ticket.created_at)}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: Conversation */}
        <div className="flex-1 min-w-0">
          {/* Conversation Thread */}
          <Card padding="none" className="mb-4">
            <div
              className="divide-y divide-border"
              role="log"
              aria-label="Conversation thread"
            >
              {/* Initial description as first message */}
              <MessageBubble
                name={ticket.created_by.full_name}
                role={ticket.created_by.role}
                body={ticket.description}
                timestamp={ticket.created_at}
                isInternal={false}
              />
              {/* Replies */}
              {replies.map((reply) => (
                <MessageBubble
                  key={reply.id}
                  name={reply.user.full_name}
                  role={reply.user.role}
                  body={reply.body}
                  timestamp={reply.created_at}
                  isInternal={reply.is_internal}
                  attachments={reply.attachments}
                />
              ))}
            </div>
          </Card>

          {/* Reply Editor */}
          <Card padding="none">
            <div className="border-b border-border">
              <Tabs
                tabs={replyTabs}
                activeTab={replyMode}
                onTabChange={(tabId) => setReplyMode(tabId as 'reply' | 'internal')}
              />
            </div>
            <TabPanel id={replyMode} activeTab={replyMode}>
              <div
                className={cn(
                  'p-4',
                  replyMode === 'internal' && 'bg-internal-note',
                )}
              >
                {replyMode === 'internal' ? (
                  <MentionInput
                    id="reply-editor"
                    value={replyBody}
                    onChange={setReplyBody}
                    placeholder="Write an internal note. Use @name to mention agents. Clients will not see this."
                    className={cn(
                      'min-h-[120px] w-full rounded-md border px-3 py-2 text-sm',
                      'bg-yellow-50 border-yellow-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                    )}
                    ariaLabel="Internal note editor with @mention support"
                    disabled={createReply.isPending}
                  />
                ) : (
                  <Textarea
                    id="reply-editor"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your reply here..."
                    className="min-h-[120px]"
                    aria-label="Reply editor"
                    disabled={createReply.isPending}
                  />
                )}
                <div className="flex items-center justify-end gap-2 mt-3">
                  <CannedResponsePicker
                    onSelect={(body) => setReplyBody((prev) => prev + body)}
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={!replyBody.trim()}
                    isLoading={createReply.isPending}
                    aria-label={
                      replyMode === 'internal' ? 'Add internal note' : 'Send reply'
                    }
                  >
                    {replyMode === 'internal' ? 'Add Note' : 'Send Reply'}
                  </Button>
                </div>
              </div>
            </TabPanel>
          </Card>
        </div>

        {/* Right column: Sidebar */}
        {isMobile ? (
          sidebarOpen && (
            <aside
              id="ticket-sidebar"
              className="w-full"
              role="complementary"
              aria-label="Ticket details"
            >
              <Card padding="lg">{sidebarContent}</Card>
            </aside>
          )
        ) : (
          <aside
            className="w-72 xl:w-80 flex-shrink-0"
            role="complementary"
            aria-label="Ticket details"
          >
            <Card padding="lg" className="sticky top-4">
              {sidebarContent}
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}

// --- Sub-Components ---

interface MessageBubbleProps {
  name: string;
  role: string;
  body: string;
  timestamp: string;
  isInternal: boolean;
  attachments?: TicketReply['attachments'];
}

function MessageBubble({
  name,
  role,
  body,
  timestamp,
  isInternal,
  attachments,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'p-4',
        isInternal && 'bg-internal-note',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{name}</span>
            {role !== 'client' && (
              <Badge variant="info" size="sm">
                {role === 'admin' ? 'Admin' : 'Agent'}
              </Badge>
            )}
            {isInternal && (
              <Badge variant="warning" size="sm">
                Internal Note
              </Badge>
            )}
            <span className="text-xs text-text-secondary">
              {formatRelative(timestamp)}
            </span>
          </div>
          <div className="mt-2 text-sm text-text-primary whitespace-pre-wrap break-words">
            {body}
          </div>
          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-surface-alt border border-border rounded-md hover:bg-gray-100 transition-colors"
                  aria-label={`Download ${attachment.file_name}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {attachment.file_name}
                  <span className="text-text-secondary">
                    ({formatFileSize(attachment.file_size)})
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SLATimerProps {
  label: string;
  dueDate: string | null;
  met: boolean | null;
}

function SLATimer({ label, dueDate, met }: SLATimerProps) {
  if (!dueDate) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-secondary">--</span>
      </div>
    );
  }

  if (met === true) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-success font-medium">Met</span>
      </div>
    );
  }

  if (met === false) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-danger font-bold">Breached</span>
      </div>
    );
  }

  const status = getSLAStatus(dueDate);
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span
        className={cn(
          'font-medium',
          status === 'on-track' && 'text-text-primary',
          status === 'warning' && 'text-warning',
          status === 'breached' && 'text-danger font-bold',
        )}
      >
        {formatSLATimeRemaining(dueDate)}
      </span>
    </div>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const description = formatAuditAction(entry);
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-text-secondary whitespace-nowrap">
        {formatRelative(entry.created_at)}
      </span>
      <span className="text-text-primary">{description}</span>
    </div>
  );
}

function formatAuditAction(entry: AuditEntry): string {
  const actor = entry.user?.full_name ?? 'System';

  if (entry.action === 'created') {
    return `Ticket created by ${actor}`;
  }

  if (entry.field_name === 'status') {
    return `${actor} changed status from ${entry.old_value ?? 'none'} to ${entry.new_value ?? 'unknown'}`;
  }

  if (entry.field_name === 'priority') {
    return `${actor} changed priority from ${entry.old_value ?? 'none'} to ${entry.new_value ?? 'unknown'}`;
  }

  if (entry.field_name === 'assigned_agent_id') {
    return `${actor} reassigned the ticket`;
  }

  return `${actor}: ${entry.action}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
