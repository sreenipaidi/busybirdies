import { eq, and, asc, count } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import {
  tickets,
  ticketReplies,
  ticketAuditEntries,
  users,
} from '../db/schema.js';
import { AppError, NotFoundError, AuthorizationError } from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import { processMentions } from './mention.service.js';
import type {
  UserRole,
  ReplySource,
  TicketReply,
  UserSummary,
  PaginatedResponse,
  CreateReplyInput,
} from '@busybirdies/shared';

/**
 * Convert a DB user row to a UserSummary response shape.
 */
function toUserSummary(user: {
  id: string;
  fullName: string;
  email: string;
  role: string;
}): UserSummary {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role as UserRole,
  };
}

/**
 * Look up a user by ID within a tenant. Returns null if not found.
 */
async function findUser(
  tenantId: string,
  userId: string,
): Promise<{ id: string; fullName: string; email: string; role: string } | null> {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  return user ?? null;
}

/**
 * Add a reply (public or internal note) to a ticket.
 *
 * Clients can only add public replies (is_internal must be false).
 * Agents/admins can add both public replies and internal notes.
 *
 * Side effects:
 * - Sets first_responded_at on the ticket if this is the first agent reply.
 * - If a client replies to a resolved ticket, the ticket is reopened.
 */
export async function addReply(
  tenantId: string,
  ticketId: string,
  input: CreateReplyInput,
  userId: string,
  userRole: UserRole,
): Promise<TicketReply> {
  const db = getDb();

  // Verify ticket exists in tenant
  const [ticketRow] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
    .limit(1);

  if (!ticketRow) {
    throw new NotFoundError('Ticket');
  }

  // Client can only view/reply to their own tickets
  if (userRole === 'client' && ticketRow.clientId !== userId) {
    throw new NotFoundError('Ticket');
  }

  // Clients cannot create internal notes
  if (userRole === 'client' && input.is_internal) {
    throw new AuthorizationError('Clients cannot create internal notes');
  }

  // Determine reply source
  let source: ReplySource;
  if (userRole === 'client') {
    source = 'portal';
  } else {
    source = 'agent_ui';
  }

  // Insert the reply
  const [reply] = await db
    .insert(ticketReplies)
    .values({
      ticketId,
      userId,
      body: input.body,
      isInternal: input.is_internal ?? false,
      source,
    })
    .returning();

  if (!reply) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create reply');
  }

  // Side effect for internal notes: process @mentions
  if (input.is_internal) {
    try {
      await processMentions(tenantId, ticketId, input.body, userId);
    } catch (err) {
      const logger = getLogger();
      logger.error({ err, ticketId, userId }, 'Failed to process mentions in internal note');
    }
  }

  // Side effects for non-internal replies
  if (!input.is_internal) {
    // Track first agent response time for SLA
    if (
      (userRole === 'agent' || userRole === 'admin') &&
      !ticketRow.firstRespondedAt
    ) {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        firstRespondedAt: now,
        updatedAt: now,
      };

      // Check SLA first response compliance
      if (ticketRow.slaFirstResponseDue) {
        updateData.slaFirstResponseMet = now <= ticketRow.slaFirstResponseDue;
      }

      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId));
    }

    // If a client replies to a resolved ticket, reopen it
    if (userRole === 'client' && ticketRow.status === 'resolved') {
      await db
        .update(tickets)
        .set({
          status: 'open',
          resolvedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      // Audit the status change
      await db.insert(ticketAuditEntries).values({
        ticketId,
        userId,
        action: 'field_changed',
        fieldName: 'status',
        oldValue: 'resolved',
        newValue: 'open',
        metadata: { reason: 'client_reply' },
      });
    }

    // Update ticket's updatedAt timestamp
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
  }

  // Build response
  const replyUser = await findUser(tenantId, userId);
  return {
    id: reply.id,
    ticket_id: reply.ticketId,
    user: replyUser
      ? toUserSummary(replyUser)
      : { id: userId, full_name: 'Unknown', email: '', role: 'client' as UserRole },
    body: reply.body,
    is_internal: reply.isInternal,
    source: reply.source as ReplySource,
    attachments: [],
    created_at: reply.createdAt.toISOString(),
  };
}

/**
 * Get paginated replies for a ticket.
 *
 * Clients can only see public replies (internal notes are filtered out).
 * Agents/admins can see all replies.
 */
export async function getReplies(
  tenantId: string,
  ticketId: string,
  userRole: UserRole,
  userId: string,
  page: number = 1,
  perPage: number = 50,
): Promise<PaginatedResponse<TicketReply>> {
  const db = getDb();

  // Verify ticket exists in tenant
  const [ticketRow] = await db
    .select({ id: tickets.id, clientId: tickets.clientId })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
    .limit(1);

  if (!ticketRow) {
    throw new NotFoundError('Ticket');
  }

  // Client can only view their own tickets
  if (userRole === 'client' && ticketRow.clientId !== userId) {
    throw new NotFoundError('Ticket');
  }

  const isClient = userRole === 'client';
  const offset = (page - 1) * perPage;

  // Build conditions
  const conditions = [eq(ticketReplies.ticketId, ticketId)];
  if (isClient) {
    conditions.push(eq(ticketReplies.isInternal, false));
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(ticketReplies)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Get paginated replies
  const rows = await db
    .select()
    .from(ticketReplies)
    .where(whereClause)
    .orderBy(asc(ticketReplies.createdAt))
    .limit(perPage)
    .offset(offset);

  const data: TicketReply[] = await Promise.all(
    rows.map(async (row) => {
      const replyUser = await findUser(tenantId, row.userId);
      return {
        id: row.id,
        ticket_id: row.ticketId,
        user: replyUser
          ? toUserSummary(replyUser)
          : { id: row.userId, full_name: 'Unknown', email: '', role: 'client' as UserRole },
        body: row.body,
        is_internal: row.isInternal,
        source: row.source as ReplySource,
        attachments: [],
        created_at: row.createdAt.toISOString(),
      };
    }),
  );

  return {
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage) || 1,
    },
  };
}
