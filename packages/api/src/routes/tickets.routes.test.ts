import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signToken } from '../lib/jwt.js';
import type { UserRole, TicketPriority, TicketSource, UserSummary } from '@supportdesk/shared';

// -------------------------------------------------------------------
// Mock services
// -------------------------------------------------------------------

vi.mock('../services/ticket.service.js', () => ({
  createTicket: vi.fn(),
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  updateTicket: vi.fn(),
  assignTicket: vi.fn(),
  getAuditTrail: vi.fn(),
}));

vi.mock('../services/reply.service.js', () => ({
  addReply: vi.fn(),
  getReplies: vi.fn(),
}));

vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(),
}));

import * as ticketService from '../services/ticket.service.js';
import * as replyService from '../services/reply.service.js';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
const mockAgentId = '660e8400-e29b-41d4-a716-446655440001';
const mockClientId = '770e8400-e29b-41d4-a716-446655440002';
const mockAdminId = '880e8400-e29b-41d4-a716-446655440003';

function generateCookie(userId: string, role: UserRole, tenantId: string = mockTenantId): string {
  const token = signToken(
    { sub: userId, tid: tenantId, role },
    '8h',
  );
  return `session=${token}`;
}

const mockClientSummary: UserSummary = {
  id: mockClientId,
  full_name: 'Test Client',
  email: 'client@example.com',
  role: 'client',
};

const mockAgentSummary: UserSummary = {
  id: mockAgentId,
  full_name: 'Test Agent',
  email: 'agent@example.com',
  role: 'agent',
};

function fakeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-001',
    ticket_number: 'TKT-00001',
    subject: 'Test ticket',
    description: 'A test description',
    priority: 'medium' as TicketPriority,
    status: 'open' as const,
    client: mockClientSummary,
    created_by: mockClientSummary,
    assigned_agent: null as UserSummary | null,
    tags: [] as string[],
    source: 'portal' as TicketSource,
    sla_first_response_due: null,
    sla_resolution_due: null,
    sla_first_response_met: null,
    sla_resolution_met: null,
    first_responded_at: null,
    resolved_at: null,
    closed_at: null,
    created_at: '2026-03-04T14:30:00.000Z',
    updated_at: '2026-03-04T14:30:00.000Z',
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Ticket routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  // ==========================================
  // POST /v1/tickets
  // ==========================================
  describe('POST /v1/tickets', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets',
        payload: { subject: 'Test', description: 'Test desc' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 201 when agent creates ticket with valid data', async () => {
      const ticket = fakeTicket();
      vi.mocked(ticketService.createTicket).mockResolvedValue(ticket);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {
          subject: 'Test ticket',
          description: 'A test description',
          priority: 'medium',
          client_id: mockClientId,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('ticket-001');
      expect(body.ticket_number).toBe('TKT-00001');
      expect(body.subject).toBe('Test ticket');
    });

    it('should return 201 when client creates ticket', async () => {
      const ticket = fakeTicket();
      vi.mocked(ticketService.createTicket).mockResolvedValue(ticket);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets',
        headers: { cookie: generateCookie(mockClientId, 'client') },
        payload: {
          subject: 'Client ticket',
          description: 'Client description',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 422 when subject is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {
          description: 'No subject',
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 when description is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {
          subject: 'No description',
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 when priority is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {
          subject: 'Test',
          description: 'Test',
          priority: 'critical',
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  // ==========================================
  // GET /v1/tickets
  // ==========================================
  describe('GET /v1/tickets', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 200 with paginated tickets for agent', async () => {
      const mockResult = {
        data: [fakeTicket()],
        pagination: { total: 1, page: 1, per_page: 25, total_pages: 1 },
      };
      vi.mocked(ticketService.listTickets).mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should pass query parameters to the service', async () => {
      const mockResult = {
        data: [],
        pagination: { total: 0, page: 1, per_page: 25, total_pages: 1 },
      };
      vi.mocked(ticketService.listTickets).mockResolvedValue(mockResult);

      await app.inject({
        method: 'GET',
        url: '/v1/tickets?status=open&priority=high&page=2&per_page=10',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
      });

      expect(ticketService.listTickets).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({
          status: 'open',
          priority: 'high',
          page: 2,
          per_page: 10,
        }),
        expect.objectContaining({ id: mockAgentId, role: 'agent' }),
      );
    });
  });

  // ==========================================
  // GET /v1/tickets/:id
  // ==========================================
  describe('GET /v1/tickets/:id', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 200 with full ticket detail for agent', async () => {
      const mockResult = {
        ticket: fakeTicket(),
        replies: [],
        audit_trail: [],
      };
      vi.mocked(ticketService.getTicket).mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ticket.id).toBe('ticket-001');
      expect(body.replies).toEqual([]);
      expect(body.audit_trail).toEqual([]);
    });

    it('should return 200 without audit trail for client', async () => {
      const mockResult = {
        ticket: fakeTicket(),
        replies: [],
      };
      vi.mocked(ticketService.getTicket).mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockClientId, 'client') },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.audit_trail).toBeUndefined();
    });
  });

  // ==========================================
  // PATCH /v1/tickets/:id
  // ==========================================
  describe('PATCH /v1/tickets/:id', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/tickets/ticket-001',
        payload: { status: 'pending' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 when client tries to update ticket', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockClientId, 'client') },
        payload: { status: 'pending' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 200 when agent updates ticket status', async () => {
      const ticket = fakeTicket({ status: 'pending' });
      vi.mocked(ticketService.updateTicket).mockResolvedValue(ticket);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: { status: 'pending' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('pending');
    });

    it('should return 422 when status value is invalid', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: { status: 'invalid_status' },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 200 when admin updates ticket priority', async () => {
      const ticket = fakeTicket({ priority: 'urgent' });
      vi.mocked(ticketService.updateTicket).mockResolvedValue(ticket);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockAdminId, 'admin') },
        payload: { priority: 'urgent' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.priority).toBe('urgent');
    });

    it('should return 200 when updating tags', async () => {
      const ticket = fakeTicket({ tags: ['billing', 'urgent'] });
      vi.mocked(ticketService.updateTicket).mockResolvedValue(ticket);

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/tickets/ticket-001',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: { tags: ['billing', 'urgent'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tags).toEqual(['billing', 'urgent']);
    });
  });

  // ==========================================
  // POST /v1/tickets/:id/replies
  // ==========================================
  describe('POST /v1/tickets/:id/replies', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/replies',
        payload: { body: 'Test reply' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 201 when agent adds a reply', async () => {
      const mockReply = {
        id: 'reply-001',
        ticket_id: 'ticket-001',
        user: mockAgentSummary,
        body: 'We are looking into it',
        is_internal: false,
        source: 'agent_ui' as const,
        attachments: [],
        created_at: '2026-03-04T15:00:00.000Z',
      };
      vi.mocked(replyService.addReply).mockResolvedValue(mockReply);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/replies',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {
          body: 'We are looking into it',
          is_internal: false,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('reply-001');
      expect(body.body).toBe('We are looking into it');
    });

    it('should return 201 when agent adds an internal note', async () => {
      const mockReply = {
        id: 'reply-002',
        ticket_id: 'ticket-001',
        user: mockAgentSummary,
        body: 'Internal note for team',
        is_internal: true,
        source: 'agent_ui' as const,
        attachments: [],
        created_at: '2026-03-04T15:00:00.000Z',
      };
      vi.mocked(replyService.addReply).mockResolvedValue(mockReply);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/replies',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {
          body: 'Internal note for team',
          is_internal: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.is_internal).toBe(true);
    });

    it('should return 422 when reply body is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/replies',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {},
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 when reply body is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/replies',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: { body: '' },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  // ==========================================
  // GET /v1/tickets/:id/replies
  // ==========================================
  describe('GET /v1/tickets/:id/replies', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001/replies',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 200 with paginated replies', async () => {
      const mockResult = {
        data: [],
        pagination: { total: 0, page: 1, per_page: 50, total_pages: 1 },
      };
      vi.mocked(replyService.getReplies).mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001/replies',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.pagination).toBeDefined();
    });
  });

  // ==========================================
  // GET /v1/tickets/:id/audit
  // ==========================================
  describe('GET /v1/tickets/:id/audit', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001/audit',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 when client tries to access audit trail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001/audit',
        headers: { cookie: generateCookie(mockClientId, 'client') },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 200 with paginated audit entries for agent', async () => {
      const mockResult = {
        data: [],
        pagination: { total: 0, page: 1, per_page: 50, total_pages: 1 },
      };
      vi.mocked(ticketService.getAuditTrail).mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/tickets/ticket-001/audit',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.pagination).toBeDefined();
    });
  });

  // ==========================================
  // POST /v1/tickets/:id/assign
  // ==========================================
  describe('POST /v1/tickets/:id/assign', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/assign',
        payload: { agent_id: mockAgentId },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 when client tries to assign ticket', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/assign',
        headers: { cookie: generateCookie(mockClientId, 'client') },
        payload: { agent_id: mockAgentId },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 200 when agent assigns ticket', async () => {
      const ticket = fakeTicket({ assigned_agent: mockAgentSummary });
      vi.mocked(ticketService.assignTicket).mockResolvedValue(ticket);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/assign',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: { agent_id: mockAgentId },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.assigned_agent).toBeDefined();
      expect(body.assigned_agent.id).toBe(mockAgentId);
    });

    it('should return 422 when agent_id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/assign',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: { agent_id: 'not-a-uuid' },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 when agent_id is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tickets/ticket-001/assign',
        headers: { cookie: generateCookie(mockAgentId, 'agent') },
        payload: {},
      });

      expect(response.statusCode).toBe(422);
    });
  });
});
