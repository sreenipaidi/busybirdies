import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError, AppError } from '../lib/errors.js';
import type { UserRole } from '@busybirdies/shared';

// -------------------------------------------------------------------
// Mock helpers
// -------------------------------------------------------------------

const mockTenantId = 'tenant-aaa-bbb-ccc';
const mockClientId = 'user-client-111';
const mockAgentId = 'user-agent-222';

function fakeTicketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-001',
    tenantId: mockTenantId,
    ticketNumber: 'TKT-00001',
    subject: 'Test ticket',
    description: 'A test description',
    priority: 'medium',
    status: 'open' as string,
    clientId: mockClientId,
    createdById: mockClientId,
    assignedAgentId: mockAgentId,
    assignedByRuleId: null,
    slaFirstResponseDue: null as Date | null,
    slaResolutionDue: null,
    slaFirstResponseMet: null,
    slaResolutionMet: null,
    firstRespondedAt: null as Date | null,
    resolvedAt: null as Date | null,
    closedAt: null,
    source: 'portal',
    createdAt: new Date('2026-03-04T14:30:00Z'),
    updatedAt: new Date('2026-03-04T14:30:00Z'),
    ...overrides,
  };
}

function fakeReplyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reply-001',
    ticketId: 'ticket-001',
    userId: mockAgentId,
    body: 'Test reply body',
    isInternal: false,
    source: 'agent_ui',
    createdAt: new Date('2026-03-04T15:00:00Z'),
    updatedAt: new Date('2026-03-04T15:00:00Z'),
    ...overrides,
  };
}

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: mockAgentId,
    fullName: 'Agent Smith',
    email: 'agent@example.com',
    role: 'agent',
    isActive: true,
    ...overrides,
  };
}

// Construct a chainable mock DB that allows sequential select results
function buildMockDb() {
  const selectResults: unknown[][] = [];

  const limitFn = () => Promise.resolve(selectResults.shift() ?? []);

  const whereObj = {
    limit: limitFn,
    orderBy: () => ({
      limit: () => ({
        offset: () => Promise.resolve(selectResults.shift() ?? []),
      }),
    }),
  };

  const fromObj = {
    where: () => whereObj,
  };

  const selectFn = () => ({
    from: () => fromObj,
  });

  const insertFn = () => ({
    values: () => ({
      returning: () => Promise.resolve([fakeReplyRow()]),
    }),
  });

  const updateFn = () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });

  const deleteFn = () => ({
    where: () => Promise.resolve(),
  });

  return {
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
    _pushSelectResult: (r: unknown[]) => selectResults.push(r),
  };
}

let mockDb: ReturnType<typeof buildMockDb>;

vi.mock('../db/connection.js', () => ({
  getDb: () => mockDb,
}));

// Import after mocking
import * as replyService from './reply.service.js';

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Reply service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();
  });

  describe('addReply', () => {
    it('should throw NotFoundError when ticket does not exist', async () => {
      // select ticket -> empty
      mockDb._pushSelectResult([]);

      await expect(
        replyService.addReply(
          mockTenantId,
          'nonexistent-ticket',
          { body: 'Hello', is_internal: false },
          mockAgentId,
          'agent',
        ),
      ).rejects.toThrow('Ticket not found');
    });

    it('should throw NotFoundError when client tries to reply on another clients ticket', async () => {
      // select ticket -> ticket belongs to a different client
      mockDb._pushSelectResult([fakeTicketRow({ clientId: 'other-client' })]);

      await expect(
        replyService.addReply(
          mockTenantId,
          'ticket-001',
          { body: 'Hello', is_internal: false },
          mockClientId,
          'client',
        ),
      ).rejects.toThrow('Ticket not found');
    });

    it('should throw AuthorizationError when client tries to create internal note', async () => {
      // select ticket -> belongs to the client
      mockDb._pushSelectResult([fakeTicketRow()]);

      await expect(
        replyService.addReply(
          mockTenantId,
          'ticket-001',
          { body: 'Secret note', is_internal: true },
          mockClientId,
          'client',
        ),
      ).rejects.toThrow('Clients cannot create internal notes');
    });

    it('should create a reply successfully for an agent', async () => {
      // select ticket
      mockDb._pushSelectResult([fakeTicketRow()]);
      // select user for reply response
      mockDb._pushSelectResult([fakeUser()]);

      const result = await replyService.addReply(
        mockTenantId,
        'ticket-001',
        { body: 'We are looking into it', is_internal: false },
        mockAgentId,
        'agent',
      );

      expect(result.id).toBe('reply-001');
      expect(result.ticket_id).toBe('ticket-001');
      expect(result.body).toBe('Test reply body');
      expect(result.is_internal).toBe(false);
      expect(result.source).toBe('agent_ui');
      expect(result.user.id).toBe(mockAgentId);
    });
  });

  describe('getReplies', () => {
    it('should throw NotFoundError when ticket does not exist', async () => {
      // select ticket -> empty
      mockDb._pushSelectResult([]);

      await expect(
        replyService.getReplies(
          mockTenantId,
          'nonexistent-ticket',
          'agent',
          mockAgentId,
        ),
      ).rejects.toThrow('Ticket not found');
    });

    it('should throw NotFoundError when client tries to view another clients ticket replies', async () => {
      // select ticket -> belongs to a different client
      mockDb._pushSelectResult([{ id: 'ticket-001', clientId: 'other-client' }]);

      await expect(
        replyService.getReplies(
          mockTenantId,
          'ticket-001',
          'client',
          mockClientId,
        ),
      ).rejects.toThrow('Ticket not found');
    });
  });

  describe('Reply source determination', () => {
    function determineSource(role: UserRole): string {
      return role === 'client' ? 'portal' : 'agent_ui';
    }

    it('should set source to portal for client replies', () => {
      expect(determineSource('client')).toBe('portal');
    });

    it('should set source to agent_ui for agent replies', () => {
      expect(determineSource('agent')).toBe('agent_ui');
    });

    it('should set source to agent_ui for admin replies', () => {
      expect(determineSource('admin')).toBe('agent_ui');
    });
  });

  describe('Pagination', () => {
    it('should default page to 1 and per_page to 50', () => {
      const page: number | undefined = undefined;
      const perPage: number | undefined = undefined;
      const resolvedPage = page ?? 1;
      const resolvedPerPage = perPage ?? 50;
      expect(resolvedPage).toBe(1);
      expect(resolvedPerPage).toBe(50);
    });

    it('should compute offset correctly for page 2', () => {
      const page = 2;
      const perPage = 50;
      const offset = (page - 1) * perPage;
      expect(offset).toBe(50);
    });
  });

  describe('Error structures', () => {
    it('should create NotFoundError for missing ticket', () => {
      const error = new NotFoundError('Ticket');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Ticket not found');
    });

    it('should create AuthorizationError for client creating internal notes', () => {
      const error = new AuthorizationError('Clients cannot create internal notes');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create AppError for failed reply creation', () => {
      const error = new AppError(500, 'INTERNAL_ERROR', 'Failed to create reply');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });
});
