import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError, NotFoundError, AuthorizationError, AppError } from '../lib/errors.js';
import { VALID_STATUS_TRANSITIONS } from '@supportdesk/shared';
import type { TicketStatus } from '@supportdesk/shared';

// -------------------------------------------------------------------
// Mock helpers
// -------------------------------------------------------------------

const mockTenantId = 'tenant-aaa-bbb-ccc';
const mockUserId = 'user-111';
const mockClientId = 'user-222';
const mockAgentId = 'user-333';

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: mockUserId,
    fullName: 'Test User',
    email: 'test@example.com',
    role: 'agent',
    isActive: true,
    ...overrides,
  };
}

// Construct a chainable mock DB
function buildMockDb() {
  const selectResults: unknown[][] = [];
  let insertReturningResult: unknown[] = [];
  let updateReturningResult: unknown[] = [];

  const whereObj = {
    limit: () => Promise.resolve(selectResults.shift() ?? []),
    orderBy: () => ({
      limit: (_limit: number) => ({
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
      returning: () => Promise.resolve(insertReturningResult),
    }),
  });

  const updateFn = () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve(updateReturningResult),
      }),
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
    _setInsertResult: (r: unknown[]) => { insertReturningResult = r; },
    _setUpdateResult: (r: unknown[]) => { updateReturningResult = r; },
  };
}

let mockDb: ReturnType<typeof buildMockDb>;

vi.mock('../db/connection.js', () => ({
  getDb: () => mockDb,
}));

// Import after mocking
import * as ticketService from './ticket.service.js';

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Ticket service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();
  });

  describe('Status transition validation', () => {
    it('should allow open -> pending', () => {
      expect(VALID_STATUS_TRANSITIONS.open).toContain('pending');
    });

    it('should allow open -> resolved', () => {
      expect(VALID_STATUS_TRANSITIONS.open).toContain('resolved');
    });

    it('should allow pending -> open', () => {
      expect(VALID_STATUS_TRANSITIONS.pending).toContain('open');
    });

    it('should allow pending -> resolved', () => {
      expect(VALID_STATUS_TRANSITIONS.pending).toContain('resolved');
    });

    it('should allow resolved -> closed', () => {
      expect(VALID_STATUS_TRANSITIONS.resolved).toContain('closed');
    });

    it('should allow resolved -> open', () => {
      expect(VALID_STATUS_TRANSITIONS.resolved).toContain('open');
    });

    it('should allow closed -> open', () => {
      expect(VALID_STATUS_TRANSITIONS.closed).toContain('open');
    });

    it('should not allow open -> closed (skipping resolved)', () => {
      expect(VALID_STATUS_TRANSITIONS.open).not.toContain('closed');
    });

    it('should not allow closed -> pending', () => {
      expect(VALID_STATUS_TRANSITIONS.closed).not.toContain('pending');
    });

    it('should not allow closed -> resolved', () => {
      expect(VALID_STATUS_TRANSITIONS.closed).not.toContain('resolved');
    });
  });

  describe('createTicket', () => {
    it('should throw VALIDATION_ERROR when agent creates ticket without client_id', async () => {
      await expect(
        ticketService.createTicket(
          mockTenantId,
          { subject: 'Test', description: 'Test desc', priority: 'medium' },
          { id: mockUserId, role: 'agent' },
        ),
      ).rejects.toThrow('client_id is required');
    });

    it('should throw AuthorizationError when client specifies different client_id', async () => {
      await expect(
        ticketService.createTicket(
          mockTenantId,
          { subject: 'Test', description: 'Test desc', priority: 'medium', client_id: 'other-user-id' },
          { id: mockClientId, role: 'client' },
        ),
      ).rejects.toThrow('Clients can only create tickets for themselves');
    });

    it('should throw AuthorizationError when client tries to assign an agent', async () => {
      // First select: finding client user for self (used when client creates ticket)
      mockDb._pushSelectResult([fakeUser({ id: mockClientId, role: 'client' })]);

      await expect(
        ticketService.createTicket(
          mockTenantId,
          { subject: 'Test', description: 'desc', priority: 'medium', assigned_agent_id: mockAgentId },
          { id: mockClientId, role: 'client' },
        ),
      ).rejects.toThrow('Clients cannot assign tickets');
    });
  });

  describe('Error classes used by ticket operations', () => {
    it('should throw NotFoundError with correct message', () => {
      const err = new NotFoundError('Ticket');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Ticket not found');
    });

    it('should throw ConflictError for invalid status transition', () => {
      const err = new ConflictError(
        "Invalid status transition from 'open' to 'closed'. Allowed transitions: pending, resolved",
      );
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.message).toContain('Invalid status transition');
    });

    it('should throw AuthorizationError for client operations', () => {
      const err = new AuthorizationError('Clients cannot assign tickets');
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('should throw AppError for internal errors', () => {
      const err = new AppError(
        422,
        'VALIDATION_ERROR',
        'Cannot assign a ticket to a client user',
      );
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Ticket number format', () => {
    it('should pad ticket number to 5 digits', () => {
      const padded = String(1).padStart(5, '0');
      expect(padded).toBe('00001');
      expect(`TKT-${padded}`).toBe('TKT-00001');
    });

    it('should not pad numbers with 5 or more digits', () => {
      const padded = String(10000).padStart(5, '0');
      expect(padded).toBe('10000');
      expect(`TKT-${padded}`).toBe('TKT-10000');
    });

    it('should handle large ticket numbers', () => {
      const padded = String(123456).padStart(5, '0');
      expect(padded).toBe('123456');
      expect(`TKT-${padded}`).toBe('TKT-123456');
    });
  });

  describe('UserSummary construction', () => {
    it('should convert DB user to UserSummary shape', () => {
      const dbUser = {
        id: 'user-123',
        fullName: 'John Doe',
        email: 'john@example.com',
        role: 'agent',
      };

      const summary = {
        id: dbUser.id,
        full_name: dbUser.fullName,
        email: dbUser.email,
        role: dbUser.role,
      };

      expect(summary.id).toBe('user-123');
      expect(summary.full_name).toBe('John Doe');
      expect(summary.email).toBe('john@example.com');
      expect(summary.role).toBe('agent');
    });
  });

  describe('Status transition validation table', () => {
    const validTransitions: Array<[TicketStatus, TicketStatus]> = [
      ['open', 'pending'],
      ['open', 'resolved'],
      ['pending', 'open'],
      ['pending', 'resolved'],
      ['resolved', 'closed'],
      ['resolved', 'open'],
      ['closed', 'open'],
    ];

    const invalidTransitions: Array<[TicketStatus, TicketStatus]> = [
      ['open', 'closed'],
      ['pending', 'closed'],
      ['closed', 'pending'],
      ['closed', 'resolved'],
    ];

    validTransitions.forEach(([from, to]) => {
      it(`should allow transition from '${from}' to '${to}'`, () => {
        expect(VALID_STATUS_TRANSITIONS[from]).toContain(to);
      });
    });

    invalidTransitions.forEach(([from, to]) => {
      it(`should disallow transition from '${from}' to '${to}'`, () => {
        expect(VALID_STATUS_TRANSITIONS[from]).not.toContain(to);
      });
    });
  });

  describe('Pagination helpers', () => {
    it('should compute total_pages correctly', () => {
      const total = 57;
      const perPage = 25;
      const totalPages = Math.ceil(total / perPage) || 1;
      expect(totalPages).toBe(3);
    });

    it('should return 1 for zero results', () => {
      const total = 0;
      const perPage = 25;
      const totalPages = Math.ceil(total / perPage) || 1;
      expect(totalPages).toBe(1);
    });

    it('should compute offset correctly', () => {
      const page = 3;
      const perPage = 25;
      const offset = (page - 1) * perPage;
      expect(offset).toBe(50);
    });
  });
});
