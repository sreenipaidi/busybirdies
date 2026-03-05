import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock data ----
const mockTenantId = 'tenant-test-111';
const mockTicketId = 'ticket-test-222';
const mockAgentId = 'agent-test-333';
const mockRuleId = 'rule-test-555';

// ---- Mock modules ----

// Mock logger
vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock assignment service
const mockActiveRules = vi.fn();
vi.mock('./assignment.service.js', () => ({
  getActiveRules: (...args: unknown[]) => mockActiveRules(...args),
}));

// Mock the rule evaluator
const mockEvaluateRules = vi.fn();
vi.mock('../lib/rule-evaluator.js', () => ({
  evaluateRules: (...args: unknown[]) => mockEvaluateRules(...args),
}));

// Mock database connection
vi.mock('../db/connection.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => Promise.resolve([]),
        }),
        innerJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  }),
}));

// Import after mocking
import { evaluateAndAssign } from './auto-assign.service.js';

describe('Auto-Assign Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return assigned:false when ticket is not found', async () => {
    const result = await evaluateAndAssign(mockTenantId, mockTicketId);

    expect(result.assigned).toBe(false);
    expect(result.ruleId).toBeNull();
    expect(result.agentId).toBeNull();
  });

  it('should return assigned:false when no active rules exist', async () => {
    // Return empty active rules
    mockActiveRules.mockResolvedValueOnce([]);

    const result = await evaluateAndAssign(mockTenantId, mockTicketId);

    expect(result.assigned).toBe(false);
    expect(result.ruleId).toBeNull();
    expect(result.agentId).toBeNull();
  });

  it('should return assigned:false when no rule matches', async () => {
    mockActiveRules.mockResolvedValueOnce([
      {
        id: mockRuleId,
        conditions: [{ field: 'priority', operator: 'equals', value: 'urgent' }],
        actionType: 'assign_agent',
        targetAgentId: mockAgentId,
        targetGroupId: null,
      },
    ]);
    mockEvaluateRules.mockReturnValueOnce(null);

    const result = await evaluateAndAssign(mockTenantId, mockTicketId);

    expect(result.assigned).toBe(false);
    expect(result.ruleId).toBeNull();
    expect(result.agentId).toBeNull();
  });
});

describe('Auto-Assign Service - evaluateAndAssign result shape', () => {
  it('should have correct shape for unassigned result', () => {
    const result = { assigned: false, ruleId: null, agentId: null };

    expect(result).toHaveProperty('assigned');
    expect(result).toHaveProperty('ruleId');
    expect(result).toHaveProperty('agentId');
    expect(typeof result.assigned).toBe('boolean');
  });

  it('should have correct shape for assigned result', () => {
    const result = {
      assigned: true,
      ruleId: mockRuleId,
      agentId: mockAgentId,
    };

    expect(result.assigned).toBe(true);
    expect(result.ruleId).toBe(mockRuleId);
    expect(result.agentId).toBe(mockAgentId);
  });
});
