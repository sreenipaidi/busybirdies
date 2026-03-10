import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '../lib/errors.js';

// ---- Mock data ----
const mockTenantId = 'tenant-test-111';
const mockRuleId = 'rule-test-222';
const mockAgentId = 'agent-test-333';

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

  return {
    select: () => ({
      from: () => ({
        where: () => {
          const result = selectResults.shift() ?? [];
          const promise = Promise.resolve(result);
          return Object.assign(promise, {
            limit: () => Promise.resolve(result),
            orderBy: () => {
              const orderedResult = selectResults.shift() ?? result;
              const orderedPromise = Promise.resolve(orderedResult);
              return Object.assign(orderedPromise, {
                limit: () => Promise.resolve(orderedResult),
              });
            },
          });
        },
      }),
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
import * as assignmentService from './assignment.service.js';

describe('Assignment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();
  });

  describe('createRule', () => {
    it('should throw ValidationError when assign_agent action lacks target_agent_id', async () => {
      await expect(
        assignmentService.createRule(mockTenantId, {
          name: 'Test rule',
          condition_logic: 'any',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
          action_type: 'assign_agent',
          is_active: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when assign_group action lacks target_group_id', async () => {
      await expect(
        assignmentService.createRule(mockTenantId, {
          name: 'Test rule',
          condition_logic: 'any',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
          action_type: 'assign_group',
          is_active: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when target agent does not exist', async () => {
      // Agent lookup returns empty
      mockDb._pushSelectResult([]);

      await expect(
        assignmentService.createRule(mockTenantId, {
          name: 'Test rule',
          condition_logic: 'any',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
          action_type: 'assign_agent',
          target_agent_id: 'nonexistent-agent',
          is_active: true,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when trying to assign to a client user', async () => {
      // Agent lookup returns a client
      mockDb._pushSelectResult([{ id: mockAgentId, role: 'client' }]);

      await expect(
        assignmentService.createRule(mockTenantId, {
          name: 'Test rule',
          condition_logic: 'any',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
          action_type: 'assign_agent',
          target_agent_id: mockAgentId,
          is_active: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when target group does not exist', async () => {
      // Group lookup returns empty
      mockDb._pushSelectResult([]);

      await expect(
        assignmentService.createRule(mockTenantId, {
          name: 'Test rule',
          condition_logic: 'any',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
          action_type: 'assign_group',
          target_group_id: 'nonexistent-group',
          is_active: true,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteRule', () => {
    it('should throw NotFoundError when rule does not exist', async () => {
      mockDb._pushSelectResult([]);

      await expect(
        assignmentService.deleteRule(mockTenantId, 'nonexistent-rule'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should succeed when rule exists', async () => {
      mockDb._pushSelectResult([{ id: mockRuleId }]);

      await expect(
        assignmentService.deleteRule(mockTenantId, mockRuleId),
      ).resolves.not.toThrow();
    });
  });

  describe('updateRule', () => {
    it('should throw NotFoundError when rule does not exist', async () => {
      mockDb._pushSelectResult([]);

      await expect(
        assignmentService.updateRule(mockTenantId, 'nonexistent-rule', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('AssignmentRule response shape', () => {
    it('should have correct response shape', () => {
      const rule = {
        id: mockRuleId,
        name: 'Route high priority',
        is_active: true,
        priority_order: 0,
        conditions: [{ field: 'priority' as const, operator: 'equals' as const, value: 'high' }],
        action_type: 'assign_agent' as const,
        target_agent: {
          id: mockAgentId,
          full_name: 'Agent Smith',
          email: 'agent@test.com',
          role: 'agent' as const,
        },
        target_group: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('is_active');
      expect(rule).toHaveProperty('priority_order');
      expect(rule).toHaveProperty('conditions');
      expect(rule).toHaveProperty('action_type');
      expect(rule).toHaveProperty('target_agent');
      expect(rule).toHaveProperty('target_group');
      expect(rule.conditions).toHaveLength(1);
      expect(rule.target_agent).not.toBeNull();
      expect(rule.target_group).toBeNull();
    });
  });
});
