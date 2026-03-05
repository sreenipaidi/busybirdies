import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError } from '../lib/errors.js';

// ---- Mock data ----
const mockTenantId = 'tenant-test-111';
const mockUserId = 'user-test-222';
const mockOtherUserId = 'user-test-333';
const mockResponseId = 'response-test-444';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---- Build chainable mock DB ----

function buildMockDb() {
  const selectResults: unknown[][] = [];
  let insertReturningResult: unknown[] = [];

  const whereObj = {
    limit: () => Promise.resolve(selectResults.shift() ?? []),
  };

  const fromObj = {
    where: () => whereObj,
  };

  return {
    select: () => ({
      from: () => fromObj,
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(insertReturningResult),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
    _pushSelectResult: (r: unknown[]) => selectResults.push(r),
    _setInsertResult: (r: unknown[]) => {
      insertReturningResult = r;
    },
  };
}

let mockDb: ReturnType<typeof buildMockDb>;

vi.mock('../db/connection.js', () => ({
  getDb: () => mockDb,
}));

// Import after mocking
import * as cannedResponseService from './canned-response.service.js';

describe('Canned Response Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();
  });

  describe('createCannedResponse', () => {
    it('should create a canned response and return it', async () => {
      const now = new Date();
      const mockRow = {
        id: mockResponseId,
        tenantId: mockTenantId,
        title: 'Password Reset',
        body: 'To reset your password...',
        category: 'Account',
        createdById: mockUserId,
        createdAt: now,
        updatedAt: now,
      };

      // The insert returns the created row
      mockDb._setInsertResult([mockRow]);

      // The buildResponse function fetches the creator user
      mockDb._pushSelectResult([
        {
          id: mockUserId,
          fullName: 'Test Agent',
          email: 'agent@test.com',
          role: 'agent',
        },
      ]);

      const result = await cannedResponseService.createCannedResponse(
        mockTenantId,
        { title: 'Password Reset', body: 'To reset your password...', category: 'Account' },
        mockUserId,
      );

      expect(result.id).toBe(mockResponseId);
      expect(result.title).toBe('Password Reset');
      expect(result.body).toBe('To reset your password...');
      expect(result.category).toBe('Account');
      expect(result.created_by.id).toBe(mockUserId);
      expect(result.created_by.full_name).toBe('Test Agent');
    });
  });

  describe('Authorization checks for agents', () => {
    it('should throw AuthorizationError when agent tries to edit another agent response', async () => {
      const existingResponse = {
        id: mockResponseId,
        tenantId: mockTenantId,
        title: 'Existing',
        body: 'Body',
        category: null,
        createdById: mockOtherUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First select returns the existing response
      mockDb._pushSelectResult([existingResponse]);

      await expect(
        cannedResponseService.updateCannedResponse(
          mockTenantId,
          mockResponseId,
          { title: 'Updated' },
          { id: mockUserId, role: 'agent' },
        ),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw AuthorizationError when agent tries to delete another agent response', async () => {
      const existingResponse = {
        id: mockResponseId,
        tenantId: mockTenantId,
        title: 'Existing',
        body: 'Body',
        category: null,
        createdById: mockOtherUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First select returns the existing response
      mockDb._pushSelectResult([existingResponse]);

      await expect(
        cannedResponseService.deleteCannedResponse(
          mockTenantId,
          mockResponseId,
          { id: mockUserId, role: 'agent' },
        ),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should allow admin to update any canned response', async () => {
      const existingResponse = {
        id: mockResponseId,
        tenantId: mockTenantId,
        title: 'Existing',
        body: 'Body',
        category: null,
        createdById: mockOtherUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First select: existing response
      mockDb._pushSelectResult([existingResponse]);

      // Second select: updated response after update
      mockDb._pushSelectResult([
        {
          ...existingResponse,
          title: 'Updated',
          updatedAt: new Date(),
        },
      ]);

      // Third select: creator user for buildResponse
      mockDb._pushSelectResult([
        {
          id: mockOtherUserId,
          fullName: 'Other Agent',
          email: 'other@test.com',
          role: 'agent',
        },
      ]);

      const result = await cannedResponseService.updateCannedResponse(
        mockTenantId,
        mockResponseId,
        { title: 'Updated' },
        { id: mockUserId, role: 'admin' },
      );

      expect(result.title).toBe('Updated');
    });
  });

  describe('NotFoundError handling', () => {
    it('should throw NotFoundError when updating non-existent response', async () => {
      // Return empty result (not found)
      mockDb._pushSelectResult([]);

      await expect(
        cannedResponseService.updateCannedResponse(
          mockTenantId,
          'nonexistent-id',
          { title: 'Updated' },
          { id: mockUserId, role: 'admin' },
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when deleting non-existent response', async () => {
      mockDb._pushSelectResult([]);

      await expect(
        cannedResponseService.deleteCannedResponse(
          mockTenantId,
          'nonexistent-id',
          { id: mockUserId, role: 'admin' },
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
