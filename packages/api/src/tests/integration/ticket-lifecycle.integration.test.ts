import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signToken } from '../../lib/jwt.js';
import type { Ticket, TicketReply, PaginatedResponse, TicketListItem } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Mocks -- must match exact function names used in routes
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/ticket.service.js', () => ({
  createTicket: vi.fn(),
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  updateTicket: vi.fn(),
  assignTicket: vi.fn(),
  getAuditTrail: vi.fn(),
}));

vi.mock('../../services/reply.service.js', () => ({
  addReply: vi.fn(),
  getReplies: vi.fn(),
}));

vi.mock('../../services/csat.service.js', () => ({
  createSurvey: vi.fn(),
  getSurvey: vi.fn(),
  submitSurvey: vi.fn(),
}));

import * as ticketService from '../../services/ticket.service.js';
import * as replyService from '../../services/reply.service.js';
import * as csatService from '../../services/csat.service.js';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tenantId = 'tenant-001';
const adminId = 'admin-001';
const agentId = 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5';
const clientId = 'client-001';

function makeToken(userId: string, role: 'admin' | 'agent' | 'client') {
  return signToken({ sub: userId, tid: tenantId, role }, '8h');
}

const agentToken = makeToken(agentId, 'agent');
const adminToken = makeToken(adminId, 'admin');
const clientToken = makeToken(clientId, 'client');

const clientSummary = { id: clientId, full_name: 'Priya Sharma', email: 'priya@client.com', role: 'client' as const };
const agentSummary = { id: agentId, full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' as const };

function fakeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-001',
    ticket_number: 'TKT-00001',
    subject: 'Cannot access billing portal',
    description: 'When I try to access the billing portal I see a blank screen.',
    priority: 'high',
    status: 'open',
    client: clientSummary,
    created_by: clientSummary,
    assigned_agent: null,
    tags: ['billing'],
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
    ...overrides,
  };
}

function fakeReply(overrides: Partial<TicketReply> = {}): TicketReply {
  return {
    id: 'reply-001',
    ticket_id: 'ticket-001',
    user: agentSummary,
    body: 'Thanks for reporting this. We are looking into it.',
    is_internal: false,
    source: 'agent_ui',
    attachments: [],
    created_at: '2026-03-04T14:45:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Full Ticket Lifecycle', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('should complete create -> reply -> resolve -> CSAT flow', async () => {
    // Step 1: Client creates a ticket
    const createdTicket = fakeTicket();
    vi.mocked(ticketService.createTicket).mockResolvedValue(createdTicket);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/tickets',
      headers: { cookie: `session=${clientToken}` },
      payload: {
        subject: 'Cannot access billing portal',
        description: 'When I try to access the billing portal I see a blank screen.',
        priority: 'high',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    expect(createBody.id).toBe('ticket-001');
    expect(createBody.status).toBe('open');
    expect(createBody.ticket_number).toBe('TKT-00001');

    // Step 2: Agent updates ticket status (assign via PATCH update)
    const updatedTicket = fakeTicket({
      assigned_agent: agentSummary,
      status: 'open',
    });
    vi.mocked(ticketService.updateTicket).mockResolvedValue(updatedTicket);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/v1/tickets/ticket-001',
      headers: { cookie: `session=${adminToken}` },
      payload: {
        assigned_agent_id: agentId,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.body).assigned_agent.id).toBe(agentId);

    // Step 3: Agent adds a reply
    const agentReply = fakeReply();
    vi.mocked(replyService.addReply).mockResolvedValue(agentReply);

    const replyRes = await app.inject({
      method: 'POST',
      url: '/v1/tickets/ticket-001/replies',
      headers: { cookie: `session=${agentToken}` },
      payload: {
        body: 'Thanks for reporting this. We are looking into it.',
        is_internal: false,
      },
    });

    expect(replyRes.statusCode).toBe(201);
    expect(JSON.parse(replyRes.body).body).toContain('Thanks for reporting');

    // Step 4: Agent resolves the ticket
    const resolvedTicket = fakeTicket({
      status: 'resolved',
      assigned_agent: agentSummary,
      resolved_at: '2026-03-04T16:00:00Z',
      sla_resolution_met: true,
    });
    vi.mocked(ticketService.updateTicket).mockResolvedValue(resolvedTicket);

    const resolveRes = await app.inject({
      method: 'PATCH',
      url: '/v1/tickets/ticket-001',
      headers: { cookie: `session=${agentToken}` },
      payload: { status: 'resolved' },
    });

    expect(resolveRes.statusCode).toBe(200);
    expect(JSON.parse(resolveRes.body).status).toBe('resolved');

    // Step 5: CSAT survey
    vi.mocked(csatService.getSurvey).mockResolvedValue({
      ticket_number: 'TKT-00001',
      subject: 'Cannot access billing portal',
      agent_name: 'Marcus Lee',
      tenant_name: 'Acme Corp',
      logo_url: null,
      brand_color: '#2563EB',
      already_submitted: false,
    });

    const surveyGetRes = await app.inject({
      method: 'GET',
      url: '/v1/csat/survey-token-abc',
    });

    expect(surveyGetRes.statusCode).toBe(200);
    expect(JSON.parse(surveyGetRes.body).already_submitted).toBe(false);

    vi.mocked(csatService.submitSurvey).mockResolvedValue({ message: 'Thank you for your feedback!' });

    const surveySubmitRes = await app.inject({
      method: 'POST',
      url: '/v1/csat/survey-token-abc',
      payload: { rating: 5, comment: 'Excellent support!' },
    });

    expect(surveySubmitRes.statusCode).toBe(200);
    expect(JSON.parse(surveySubmitRes.body).message).toContain('Thank you');
  });

  it('should handle agent adding an internal note', async () => {
    const internalNote = fakeReply({ id: 'reply-002', body: '@Sarah check billing logs?', is_internal: true });
    vi.mocked(replyService.addReply).mockResolvedValue(internalNote);

    const noteRes = await app.inject({
      method: 'POST',
      url: '/v1/tickets/ticket-001/replies',
      headers: { cookie: `session=${agentToken}` },
      payload: { body: '@Sarah check billing logs?', is_internal: true },
    });

    expect(noteRes.statusCode).toBe(201);
    expect(JSON.parse(noteRes.body).is_internal).toBe(true);
  });

  it('should prevent client from creating internal notes', async () => {
    const { AuthorizationError } = await import('../../lib/errors.js');
    vi.mocked(replyService.addReply).mockRejectedValue(
      new AuthorizationError('Clients cannot create internal notes'),
    );

    const noteRes = await app.inject({
      method: 'POST',
      url: '/v1/tickets/ticket-001/replies',
      headers: { cookie: `session=${clientToken}` },
      payload: { body: 'This should fail', is_internal: true },
    });

    expect(noteRes.statusCode).toBe(403);
  });

  it('should reject invalid status transitions', async () => {
    const { ConflictError } = await import('../../lib/errors.js');
    vi.mocked(ticketService.updateTicket).mockRejectedValue(
      new ConflictError("Invalid status transition from 'open' to 'closed'."),
    );

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/tickets/ticket-001',
      headers: { cookie: `session=${agentToken}` },
      payload: { status: 'closed' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('should list tickets with pagination for the agent', async () => {
    const mockList: PaginatedResponse<TicketListItem> = {
      data: [{
        id: 'ticket-001', ticket_number: 'TKT-00001', subject: 'Billing issue',
        priority: 'high', status: 'open', client: clientSummary, assigned_agent: agentSummary,
        tags: ['billing'], sla_first_response_due: null, sla_first_response_met: null,
        created_at: '2026-03-04T14:30:00Z', updated_at: '2026-03-04T14:30:00Z',
      }],
      pagination: { total: 1, page: 1, per_page: 25, total_pages: 1 },
    };
    vi.mocked(ticketService.listTickets).mockResolvedValue(mockList);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/tickets?status=open&page=1&per_page=25',
      headers: { cookie: `session=${agentToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const body = JSON.parse(listRes.body);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('should retrieve full ticket detail', async () => {
    const detail = {
      ticket: fakeTicket({ assigned_agent: agentSummary }),
      replies: [fakeReply()],
      audit_trail: [{ id: 'a-1', ticket_id: 'ticket-001', user: null, action: 'created', field_name: null, old_value: null, new_value: null, metadata: { source: 'portal' }, created_at: '2026-03-04T14:30:00Z' }],
    };
    vi.mocked(ticketService.getTicket).mockResolvedValue(detail);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/tickets/ticket-001',
      headers: { cookie: `session=${agentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ticket.id).toBe('ticket-001');
    expect(body.replies).toHaveLength(1);
    expect(body.audit_trail).toHaveLength(1);
  });

  it('should prevent unauthenticated access', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/tickets', payload: { subject: 'T', description: 'T', priority: 'low' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/v1/tickets' })).statusCode).toBe(401);
  });

  it('should handle CSAT already submitted error', async () => {
    const { ConflictError } = await import('../../lib/errors.js');
    vi.mocked(csatService.submitSurvey).mockRejectedValue(new ConflictError('Already submitted.'));

    const res = await app.inject({ method: 'POST', url: '/v1/csat/t', payload: { rating: 4 } });
    expect(res.statusCode).toBe(409);
  });

  it('should handle CSAT invalid token error', async () => {
    const { AppError } = await import('../../lib/errors.js');
    vi.mocked(csatService.getSurvey).mockRejectedValue(new AppError(400, 'INVALID_TOKEN', 'Expired.'));

    const res = await app.inject({ method: 'GET', url: '/v1/csat/bad-token' });
    expect(res.statusCode).toBe(400);
  });
});
