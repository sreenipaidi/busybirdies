import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Textarea } from '../../components/ui/Input.js';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { usePortalTicketDetail, usePortalCreateReply } from '../../hooks/usePortalTickets.js';
import { useUIStore } from '../../stores/ui.store.js';
import { formatDateTime, formatRelative } from '../../lib/format-date.js';
import { cn } from '../../lib/cn.js';
import type { TicketReply } from '@busybirdies/shared';
import type { TicketStatusVariant, PriorityVariant } from '../../components/ui/Badge.js';

export function PortalTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading, isError, error } = usePortalTicketDetail(id ?? '');
  const createReply = usePortalCreateReply(id ?? '');

  const [replyBody, setReplyBody] = useState('');

  const ticket = data?.ticket;
  const replies = data?.replies ?? [];

  const canReply = ticket && ticket.status !== 'closed';

  const handleSendReply = useCallback(async () => {
    if (!replyBody.trim()) return;

    try {
      await createReply.mutateAsync({ body: replyBody.trim() });
      setReplyBody('');
      addToast({
        type: 'success',
        message: 'Reply sent successfully.',
      });
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to send reply. Your message has been saved. Please try again.',
      });
    }
  }, [replyBody, createReply, addToast]);

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
        <Button variant="secondary" onClick={() => navigate('/portal')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/portal/tickets"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors mb-4"
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

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
          <h1 className="text-xl font-bold text-text-primary">
            {ticket.ticket_number}
          </h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status as TicketStatusVariant} />
            <PriorityBadge priority={ticket.priority as PriorityVariant} />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          {ticket.subject}
        </h2>
      </div>

      {/* Metadata bar */}
      <Card padding="sm" className="mb-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-text-secondary">Created: </span>
            <span className="text-text-primary font-medium">
              {formatDateTime(ticket.created_at)}
            </span>
          </div>
          <div>
            <span className="text-text-secondary">Last updated: </span>
            <span className="text-text-primary font-medium">
              {formatRelative(ticket.updated_at)}
            </span>
          </div>
          <div>
            <span className="text-text-secondary">Priority: </span>
            <PriorityBadge priority={ticket.priority as PriorityVariant} />
          </div>
        </div>
      </Card>

      {/* Conversation thread */}
      <Card padding="none" className="mb-4">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">
            Conversation
          </h3>
        </div>
        <div
          className="divide-y divide-border"
          role="log"
          aria-label="Conversation thread"
        >
          {/* Initial description */}
          <ClientMessageBubble
            name={ticket.created_by.full_name}
            role={ticket.created_by.role}
            body={ticket.description}
            timestamp={ticket.created_at}
          />
          {/* Replies (only public, server already filters for clients) */}
          {replies.map((reply) => (
            <ClientMessageBubble
              key={reply.id}
              name={reply.user.full_name}
              role={reply.user.role}
              body={reply.body}
              timestamp={reply.created_at}
              attachments={reply.attachments}
            />
          ))}
        </div>
      </Card>

      {/* Reply form (visible only if not closed) */}
      {canReply && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-base font-semibold text-text-primary">
              Reply
            </h3>
          </div>
          <div className="p-4">
            <Textarea
              id="portal-reply-editor"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your reply here..."
              className="min-h-[120px]"
              aria-label="Reply editor"
              disabled={createReply.isPending}
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button
                onClick={handleSendReply}
                disabled={!replyBody.trim()}
                isLoading={createReply.isPending}
                aria-label="Send reply"
              >
                Send Reply
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Closed ticket message */}
      {ticket.status === 'closed' && (
        <Card padding="md" className="text-center">
          <p className="text-sm text-text-secondary">
            This ticket is closed. If you need further assistance, please{' '}
            <Link
              to="/portal/tickets/new"
              className="text-primary hover:text-primary-hover font-medium"
            >
              create a new ticket
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components ---

interface ClientMessageBubbleProps {
  name: string;
  role: string;
  body: string;
  timestamp: string;
  attachments?: TicketReply['attachments'];
}

function ClientMessageBubble({
  name,
  role,
  body,
  timestamp,
  attachments,
}: ClientMessageBubbleProps) {
  const isAgent = role === 'agent' || role === 'admin';

  return (
    <div className={cn('p-4', isAgent && 'bg-primary-light/30')}>
      <div className="flex items-start gap-3">
        <Avatar name={name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{name}</span>
            {isAgent && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary-light text-primary">
                Support
              </span>
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
