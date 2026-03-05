import { eq, and, or, ilike, count, desc, asc, sql, inArray, gte, lte } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import {
  tickets,
  ticketTags,
  ticketAuditEntries,
  ticketReplies,
  users,
  tenants,
} from '../db/schema.js';
import {
  AppError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../lib/errors.js';
import { VALID_STATUS_TRANSITIONS } from '@supportdesk/shared';
import type {
  TicketStatus,
  TicketPriority,
  TicketSource,
  UserRole,
  ReplySource,
  Ticket,
  TicketListItem,
  TicketReply,
  AuditEntry,
  UserSummary,
  PaginatedResponse,
  CreateTicketInput,
  UpdateTicketInput,
  TicketListQuery,
} from '@supportdesk/shared';

/** Internal type for DB user rows used in ticket operations. */
interface DbUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
}

/**
 * Convert a DB user row to a UserSummary response shape.
 */
function toUserSummary(user: DbUser): UserSummary {
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
async function findUser(tenantId: string, userId: string): Promise<DbUser | null> {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  return user ?? null;
}

/**
 * Look up a user by ID within a tenant. Throws NotFoundError if not found.
 */
async function requireUser(tenantId: string, userId: string, label: string): Promise<DbUser> {
  const user = await findUser(tenantId, userId);
  if (!user) {
    throw new NotFoundError(label);
  }
  return user;
}

/**
 * Get all tags for a ticket, returned as an array of strings.
 */
async function getTicketTags(ticketId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ tag: ticketTags.tag })
    .from(ticketTags)
    .where(eq(ticketTags.ticketId, ticketId));

  return rows.map((r) => r.tag);
}

/**
 * Set the tags on a ticket, replacing any existing tags.
 */
async function setTicketTags(ticketId: string, tags: string[]): Promise<void> {
  const db = getDb();
  // Delete existing tags
  await db.delete(ticketTags).where(eq(ticketTags.ticketId, ticketId));
  // Insert new tags
  if (tags.length > 0) {
    const values = tags.map((tag) => ({ ticketId, tag }));
    await db.insert(ticketTags).values(values);
  }
}

/**
 * Generate the next sequential ticket number for a tenant.
 * Uses an atomic increment on the tenant's ticket_counter column.
 * Returns a string like "TKT-00001".
 */
async function generateTicketNumber(tenantId: string): Promise<string> {
  const db = getDb();
  const [result] = await db
    .update(tenants)
    .set({
      ticketCounter: sql`${tenants.ticketCounter} + 1`,
    })
    .where(eq(tenants.id, tenantId))
    .returning({ counter: tenants.ticketCounter });

  if (!result) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to generate ticket number');
  }

  const padded = String(result.counter).padStart(5, '0');
  return `TKT-${padded}`;
}

/**
 * Create an audit trail entry for a ticket.
 */
async function createAuditEntry(params: {
  ticketId: string;
  userId: string | null;
  action: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(ticketAuditEntries).values({
    ticketId: params.ticketId,
    userId: params.userId,
    action: params.action,
    fieldName: params.fieldName ?? null,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    metadata: params.metadata ?? null,
  });
}

/**
 * Build the full Ticket response object from a DB ticket row.
 */
async function buildTicketResponse(
  tenantId: string,
  ticketRow: {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    priority: string;
    status: string;
    clientId: string;
    createdById: string;
    assignedAgentId: string | null;
    source: string;
    slaFirstResponseDue: Date | null;
    slaResolutionDue: Date | null;
    slaFirstResponseMet: boolean | null;
    slaResolutionMet: boolean | null;
    firstRespondedAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
): Promise<Ticket> {
  const client = await requireUser(tenantId, ticketRow.clientId, 'Client');
  const createdBy = await requireUser(tenantId, ticketRow.createdById, 'Created by user');
  const assignedAgent = ticketRow.assignedAgentId
    ? await findUser(tenantId, ticketRow.assignedAgentId)
    : null;
  const tags = await getTicketTags(ticketRow.id);

  return {
    id: ticketRow.id,
    ticket_number: ticketRow.ticketNumber,
    subject: ticketRow.subject,
    description: ticketRow.description,
    priority: ticketRow.priority as TicketPriority,
    status: ticketRow.status as TicketStatus,
    client: toUserSummary(client),
    created_by: toUserSummary(createdBy),
    assigned_agent: assignedAgent ? toUserSummary(assignedAgent) : null,
    tags,
    source: ticketRow.source as TicketSource,
    sla_first_response_due: ticketRow.slaFirstResponseDue?.toISOString() ?? null,
    sla_resolution_due: ticketRow.slaResolutionDue?.toISOString() ?? null,
    sla_first_response_met: ticketRow.slaFirstResponseMet ?? null,
    sla_resolution_met: ticketRow.slaResolutionMet ?? null,
    first_responded_at: ticketRow.firstRespondedAt?.toISOString() ?? null,
    resolved_at: ticketRow.resolvedAt?.toISOString() ?? null,
    closed_at: ticketRow.closedAt?.toISOString() ?? null,
    created_at: ticketRow.createdAt.toISOString(),
    updated_at: ticketRow.updatedAt.toISOString(),
  };
}

/**
 * Create a new ticket within a tenant.
 *
 * Agents/admins can specify a client_id, assigned_agent_id, and tags.
 * Clients can only create tickets for themselves.
 * Generates a sequential ticket number (TKT-00001, TKT-00002, etc.).
 */
export async function createTicket(
  tenantId: string,
  input: CreateTicketInput,
  createdBy: { id: string; role: UserRole },
): Promise<Ticket> {
  const db = getDb();

  // Determine client ID
  let clientId: string;
  if (createdBy.role === 'client') {
    // Clients can only create tickets for themselves
    clientId = createdBy.id;
    if (input.client_id && input.client_id !== createdBy.id) {
      throw new AuthorizationError('Clients can only create tickets for themselves');
    }
  } else {
    // Agents/admins must specify a client_id, or we use their own ID if they are creating for themselves
    if (input.client_id) {
      const clientUser = await findUser(tenantId, input.client_id);
      if (!clientUser) {
        throw new NotFoundError('Client');
      }
      clientId = input.client_id;
    } else {
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'client_id is required when creating a ticket as an agent or admin',
      );
    }
  }

  // Validate assigned agent if provided
  if (input.assigned_agent_id) {
    if (createdBy.role === 'client') {
      throw new AuthorizationError('Clients cannot assign tickets');
    }
    const agent = await findUser(tenantId, input.assigned_agent_id);
    if (!agent) {
      throw new NotFoundError('Assigned agent');
    }
    if (agent.role === 'client') {
      throw new AppError(422, 'VALIDATION_ERROR', 'Cannot assign a ticket to a client user');
    }
    if (!agent.isActive) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Cannot assign a ticket to an inactive agent');
    }
  }

  // Determine source
  const source: TicketSource = createdBy.role === 'client' ? 'portal' : 'agent';

  // Generate ticket number
  const ticketNumber = await generateTicketNumber(tenantId);

  // Insert the ticket
  const [ticket] = await db
    .insert(tickets)
    .values({
      tenantId,
      ticketNumber,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'medium',
      status: 'open',
      clientId,
      createdById: createdBy.id,
      assignedAgentId: input.assigned_agent_id ?? null,
      source,
    })
    .returning();

  if (!ticket) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create ticket');
  }

  // Insert tags if provided
  if (input.tags && input.tags.length > 0) {
    await setTicketTags(ticket.id, input.tags);
  }

  // Create audit entry for ticket creation
  await createAuditEntry({
    ticketId: ticket.id,
    userId: null,
    action: 'created',
    metadata: { source },
  });

  // Create audit entry for assignment if agent was assigned at creation
  if (input.assigned_agent_id) {
    const agent = await findUser(tenantId, input.assigned_agent_id);
    await createAuditEntry({
      ticketId: ticket.id,
      userId: createdBy.id,
      action: 'field_changed',
      fieldName: 'assigned_agent_id',
      oldValue: null,
      newValue: agent ? agent.fullName : input.assigned_agent_id,
    });
  }

  return buildTicketResponse(tenantId, ticket);
}

/**
 * List tickets within a tenant with filtering, sorting, and pagination.
 *
 * Agents/admins see all tickets. Clients only see their own tickets.
 */
export async function listTickets(
  tenantId: string,
  query: TicketListQuery,
  requestUser: { id: string; role: UserRole },
): Promise<PaginatedResponse<TicketListItem>> {
  const db = getDb();
  const page = query.page ?? 1;
  const perPage = query.per_page ?? 25;
  const offset = (page - 1) * perPage;

  // Build filter conditions
  const conditions = [eq(tickets.tenantId, tenantId)];

  // Client scope restriction
  if (requestUser.role === 'client') {
    conditions.push(eq(tickets.clientId, requestUser.id));
  }

  // Status filter (comma-separated)
  if (query.status) {
    const statuses = query.status.split(',').map((s) => s.trim());
    if (statuses.length === 1) {
      conditions.push(eq(tickets.status, statuses[0]!));
    } else {
      conditions.push(inArray(tickets.status, statuses));
    }
  }

  // Priority filter (comma-separated)
  if (query.priority) {
    const priorities = query.priority.split(',').map((s) => s.trim());
    if (priorities.length === 1) {
      conditions.push(eq(tickets.priority, priorities[0]!));
    } else {
      conditions.push(inArray(tickets.priority, priorities));
    }
  }

  // Assigned agent filter
  if (query.assigned_agent_id) {
    conditions.push(eq(tickets.assignedAgentId, query.assigned_agent_id));
  }

  // Client filter (agents/admins only)
  if (query.client_id && requestUser.role !== 'client') {
    conditions.push(eq(tickets.clientId, query.client_id));
  }

  // Date range filters
  if (query.date_from) {
    conditions.push(gte(tickets.createdAt, new Date(query.date_from)));
  }
  if (query.date_to) {
    conditions.push(lte(tickets.createdAt, new Date(query.date_to)));
  }

  // Search by subject or ticket number
  if (query.search) {
    const searchPattern = `%${query.search}%`;
    conditions.push(
      or(
        ilike(tickets.subject, searchPattern),
        ilike(tickets.ticketNumber, searchPattern),
      )!,
    );
  }

  // Tag filter (comma-separated): find tickets that have any of these tags
  if (query.tags) {
    const tagList = query.tags.split(',').map((t) => t.trim());
    const taggedTicketIds = db
      .select({ ticketId: ticketTags.ticketId })
      .from(ticketTags)
      .where(inArray(ticketTags.tag, tagList));

    conditions.push(inArray(tickets.id, taggedTicketIds));
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(tickets)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Determine sort column and direction
  const sortBy = query.sort_by ?? 'updated_at';
  const sortOrder = query.sort_order ?? 'desc';

  let orderByColumn;
  switch (sortBy) {
    case 'created_at':
      orderByColumn = tickets.createdAt;
      break;
    case 'priority':
      orderByColumn = tickets.priority;
      break;
    case 'updated_at':
    default:
      orderByColumn = tickets.updatedAt;
      break;
  }

  const orderFn = sortOrder === 'asc' ? asc : desc;

  // Get paginated ticket rows
  const rows = await db
    .select()
    .from(tickets)
    .where(whereClause)
    .orderBy(orderFn(orderByColumn))
    .limit(perPage)
    .offset(offset);

  // Build response items with user summaries and tags
  const data: TicketListItem[] = await Promise.all(
    rows.map(async (row) => {
      const client = await findUser(tenantId, row.clientId);
      const assignedAgent = row.assignedAgentId
        ? await findUser(tenantId, row.assignedAgentId)
        : null;
      const tags = await getTicketTags(row.id);

      return {
        id: row.id,
        ticket_number: row.ticketNumber,
        subject: row.subject,
        priority: row.priority as TicketPriority,
        status: row.status as TicketStatus,
        client: client ? toUserSummary(client) : { id: row.clientId, full_name: 'Unknown', email: '', role: 'client' as UserRole },
        assigned_agent: assignedAgent ? toUserSummary(assignedAgent) : null,
        tags,
        sla_first_response_due: row.slaFirstResponseDue?.toISOString() ?? null,
        sla_first_response_met: row.slaFirstResponseMet ?? null,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
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

/**
 * Get full ticket detail including replies and audit trail.
 *
 * For clients: replies exclude internal notes, audit trail is omitted.
 * For agents/admins: all replies and audit trail are included.
 */
export async function getTicket(
  tenantId: string,
  ticketId: string,
  requestUser: { id: string; role: UserRole },
): Promise<{
  ticket: Ticket;
  replies: TicketReply[];
  audit_trail?: AuditEntry[];
}> {
  const db = getDb();

  // Find the ticket
  const [ticketRow] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
    .limit(1);

  if (!ticketRow) {
    throw new NotFoundError('Ticket');
  }

  // Client can only view their own tickets
  if (requestUser.role === 'client' && ticketRow.clientId !== requestUser.id) {
    throw new NotFoundError('Ticket');
  }

  const ticket = await buildTicketResponse(tenantId, ticketRow);

  // Get replies
  const isClient = requestUser.role === 'client';

  const replyConditions = [eq(ticketReplies.ticketId, ticketId)];
  if (isClient) {
    replyConditions.push(eq(ticketReplies.isInternal, false));
  }

  const replyRows = await db
    .select()
    .from(ticketReplies)
    .where(and(...replyConditions))
    .orderBy(asc(ticketReplies.createdAt));

  const replies: TicketReply[] = await Promise.all(
    replyRows.map(async (row) => {
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
        attachments: [], // Attachments are handled by a separate service
        created_at: row.createdAt.toISOString(),
      };
    }),
  );

  // Get audit trail (agents/admins only)
  if (isClient) {
    return { ticket, replies };
  }

  const auditRows = await db
    .select()
    .from(ticketAuditEntries)
    .where(eq(ticketAuditEntries.ticketId, ticketId))
    .orderBy(asc(ticketAuditEntries.createdAt));

  const audit_trail: AuditEntry[] = await Promise.all(
    auditRows.map(async (row) => {
      const auditUser = row.userId
        ? await findUser(tenantId, row.userId)
        : null;
      return {
        id: row.id,
        ticket_id: row.ticketId,
        user: auditUser ? toUserSummary(auditUser) : null,
        action: row.action,
        field_name: row.fieldName,
        old_value: row.oldValue,
        new_value: row.newValue,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
        created_at: row.createdAt.toISOString(),
      };
    }),
  );

  return { ticket, replies, audit_trail };
}

/**
 * Validate that a status transition is allowed according to the ticket lifecycle.
 * Throws a ConflictError if the transition is invalid.
 */
function validateStatusTransition(
  currentStatus: TicketStatus,
  newStatus: TicketStatus,
): void {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    throw new ConflictError(
      `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowedTransitions.join(', ')}`,
    );
  }
}

/**
 * Update a ticket's fields. Only agents/admins can update tickets.
 *
 * Supports updating: status, priority, assigned_agent_id, tags.
 * All changes are recorded in the audit trail.
 * Status transitions are validated against the allowed lifecycle.
 */
export async function updateTicket(
  tenantId: string,
  ticketId: string,
  input: UpdateTicketInput,
  updatedBy: { id: string; role: UserRole },
): Promise<Ticket> {
  const db = getDb();

  // Find the ticket
  const [ticketRow] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
    .limit(1);

  if (!ticketRow) {
    throw new NotFoundError('Ticket');
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  // Status update with transition validation
  if (input.status !== undefined && input.status !== ticketRow.status) {
    validateStatusTransition(ticketRow.status as TicketStatus, input.status);
    await createAuditEntry({
      ticketId,
      userId: updatedBy.id,
      action: 'field_changed',
      fieldName: 'status',
      oldValue: ticketRow.status,
      newValue: input.status,
    });
    updateValues.status = input.status;

    // Set resolved_at/closed_at timestamps
    if (input.status === 'resolved') {
      updateValues.resolvedAt = new Date();
    }
    if (input.status === 'closed') {
      updateValues.closedAt = new Date();
    }
    // Clear resolved_at if reopening from resolved
    if (input.status === 'open' && ticketRow.status === 'resolved') {
      updateValues.resolvedAt = null;
    }
  }

  // Priority update
  if (input.priority !== undefined && input.priority !== ticketRow.priority) {
    await createAuditEntry({
      ticketId,
      userId: updatedBy.id,
      action: 'field_changed',
      fieldName: 'priority',
      oldValue: ticketRow.priority,
      newValue: input.priority,
    });
    updateValues.priority = input.priority;
  }

  // Assignment update
  if (input.assigned_agent_id !== undefined) {
    const newAgentId = input.assigned_agent_id;

    if (newAgentId !== null && newAgentId !== ticketRow.assignedAgentId) {
      // Validate the new agent exists and is active
      const agent = await findUser(tenantId, newAgentId);
      if (!agent) {
        throw new NotFoundError('Assigned agent');
      }
      if (agent.role === 'client') {
        throw new AppError(422, 'VALIDATION_ERROR', 'Cannot assign a ticket to a client user');
      }
      if (!agent.isActive) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Cannot assign a ticket to an inactive agent');
      }

      // Audit the old agent name
      let oldAgentName: string | null = null;
      if (ticketRow.assignedAgentId) {
        const oldAgent = await findUser(tenantId, ticketRow.assignedAgentId);
        oldAgentName = oldAgent ? oldAgent.fullName : ticketRow.assignedAgentId;
      }

      await createAuditEntry({
        ticketId,
        userId: updatedBy.id,
        action: 'field_changed',
        fieldName: 'assigned_agent_id',
        oldValue: oldAgentName,
        newValue: agent.fullName,
      });
      updateValues.assignedAgentId = newAgentId;
    } else if (newAgentId === null && ticketRow.assignedAgentId !== null) {
      // Unassigning
      let oldAgentName: string | null = null;
      if (ticketRow.assignedAgentId) {
        const oldAgent = await findUser(tenantId, ticketRow.assignedAgentId);
        oldAgentName = oldAgent ? oldAgent.fullName : ticketRow.assignedAgentId;
      }
      await createAuditEntry({
        ticketId,
        userId: updatedBy.id,
        action: 'field_changed',
        fieldName: 'assigned_agent_id',
        oldValue: oldAgentName,
        newValue: null,
      });
      updateValues.assignedAgentId = null;
    }
  }

  // Tags update
  if (input.tags !== undefined) {
    const currentTags = await getTicketTags(ticketId);
    const newTags = input.tags;
    const sortedCurrent = [...currentTags].sort().join(',');
    const sortedNew = [...newTags].sort().join(',');
    if (sortedCurrent !== sortedNew) {
      await createAuditEntry({
        ticketId,
        userId: updatedBy.id,
        action: 'field_changed',
        fieldName: 'tags',
        oldValue: currentTags.join(', '),
        newValue: newTags.join(', '),
      });
      await setTicketTags(ticketId, newTags);
    }
  }

  // Apply updates
  await db.update(tickets).set(updateValues).where(eq(tickets.id, ticketId));

  // Fetch updated ticket
  const [updatedRow] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!updatedRow) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve updated ticket');
  }

  return buildTicketResponse(tenantId, updatedRow);
}

/**
 * Assign a ticket to a specific agent. Only agents/admins can assign.
 *
 * Validates that the target agent exists, is active, and is not a client.
 * Records the assignment in the audit trail.
 */
export async function assignTicket(
  tenantId: string,
  ticketId: string,
  agentId: string,
  assignedBy: { id: string; role: UserRole },
): Promise<Ticket> {
  return updateTicket(
    tenantId,
    ticketId,
    { assigned_agent_id: agentId },
    assignedBy,
  );
}

/**
 * Get the paginated audit trail for a ticket.
 * Only agents/admins can access the audit trail.
 */
export async function getAuditTrail(
  tenantId: string,
  ticketId: string,
  page: number = 1,
  perPage: number = 50,
): Promise<PaginatedResponse<AuditEntry>> {
  const db = getDb();

  // Verify ticket exists in tenant
  const [ticketRow] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
    .limit(1);

  if (!ticketRow) {
    throw new NotFoundError('Ticket');
  }

  const offset = (page - 1) * perPage;

  // Count total entries
  const [countResult] = await db
    .select({ total: count() })
    .from(ticketAuditEntries)
    .where(eq(ticketAuditEntries.ticketId, ticketId));

  const total = countResult?.total ?? 0;

  // Get paginated audit entries
  const rows = await db
    .select()
    .from(ticketAuditEntries)
    .where(eq(ticketAuditEntries.ticketId, ticketId))
    .orderBy(asc(ticketAuditEntries.createdAt))
    .limit(perPage)
    .offset(offset);

  const data: AuditEntry[] = await Promise.all(
    rows.map(async (row) => {
      const auditUser = row.userId
        ? await findUser(tenantId, row.userId)
        : null;
      return {
        id: row.id,
        ticket_id: row.ticketId,
        user: auditUser ? toUserSummary(auditUser) : null,
        action: row.action,
        field_name: row.fieldName,
        old_value: row.oldValue,
        new_value: row.newValue,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
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
