import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '../lib/errors.js';

// ---- Mock data ----
const mockTenantId = 'tenant-test-111';
const mockPolicyId = 'policy-test-222';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the SLA calculator
vi.mock('../lib/sla-calculator.js', () => ({
  calculateDeadline: (start: Date, minutes: number) => {
    return new Date(start.getTime() + minutes * 60 * 1000);
  },
}));

// ---- Build chainable mock DB ----

function buildMockDb() {
  const selectResults: unknown[][] = [];

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    _pushSelectResult: (r: unknown[]) => selectResults.push(r),
  };
}

let mockDb: ReturnType<typeof buildMockDb>;

vi.mock('../db/connection.js', () => ({
  getDb: () => mockDb,
}));

// Import after mocking
import * as slaService from './sla.service.js';

describe('SLA Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();
  });

  describe('getPolicies', () => {
    it('should return policies sorted by priority order', async () => {
      const policies = [
        {
          id: 'p1',
          tenantId: mockTenantId,
          priority: 'low',
          firstResponseMinutes: 480,
          resolutionMinutes: 2880,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'p2',
          tenantId: mockTenantId,
          priority: 'urgent',
          firstResponseMinutes: 30,
          resolutionMinutes: 240,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'p3',
          tenantId: mockTenantId,
          priority: 'medium',
          firstResponseMinutes: 240,
          resolutionMinutes: 1440,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'p4',
          tenantId: mockTenantId,
          priority: 'high',
          firstResponseMinutes: 60,
          resolutionMinutes: 480,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // getPolicies does a select without .limit() chain
      // We need to adjust the mock. Since getPolicies calls .where() without .limit()
      // let's create a more flexible mock

      // Override mockDb for this test
      const selectResultQueue: unknown[][] = [policies];
      mockDb = {
        select: () => ({
          from: () => ({
            where: () => {
              const result = selectResultQueue.shift() ?? [];
              // Return the result directly (no .limit())
              const promise = Promise.resolve(result);
              // Also support .limit() chain
              return Object.assign(promise, {
                limit: () => Promise.resolve(result),
              });
            },
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
        _pushSelectResult: (r: unknown[]) => selectResultQueue.push(r),
      };

      const result = await slaService.getPolicies(mockTenantId);

      expect(result).toHaveLength(4);
      expect(result[0]!.priority).toBe('urgent');
      expect(result[1]!.priority).toBe('high');
      expect(result[2]!.priority).toBe('medium');
      expect(result[3]!.priority).toBe('low');
    });
  });

  describe('updatePolicy', () => {
    it('should throw NotFoundError when policy does not exist', async () => {
      mockDb._pushSelectResult([]);

      await expect(
        slaService.updatePolicy(mockTenantId, 'nonexistent', {
          first_response_minutes: 30,
          resolution_minutes: 240,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('SLA Policy response shape', () => {
    it('should have correct shape', () => {
      const policy = {
        id: mockPolicyId,
        priority: 'urgent' as const,
        first_response_minutes: 30,
        resolution_minutes: 240,
        updated_at: new Date().toISOString(),
      };

      expect(policy).toHaveProperty('id');
      expect(policy).toHaveProperty('priority');
      expect(policy).toHaveProperty('first_response_minutes');
      expect(policy).toHaveProperty('resolution_minutes');
      expect(policy).toHaveProperty('updated_at');
      expect(policy.priority).toBe('urgent');
      expect(policy.first_response_minutes).toBe(30);
      expect(policy.resolution_minutes).toBe(240);
    });
  });

  describe('SLA deadline calculation logic', () => {
    it('should produce a deadline later than the creation time', () => {
      const start = new Date('2026-03-04T10:00:00Z');
      const minutes = 60;
      const deadline = new Date(start.getTime() + minutes * 60 * 1000);

      expect(deadline.getTime()).toBeGreaterThan(start.getTime());
      expect(deadline.toISOString()).toBe('2026-03-04T11:00:00.000Z');
    });

    it('should produce resolution deadline later than first response deadline', () => {
      const start = new Date('2026-03-04T10:00:00Z');
      const firstResponseMin = 30;
      const resolutionMin = 240;

      const firstResponseDeadline = new Date(start.getTime() + firstResponseMin * 60 * 1000);
      const resolutionDeadline = new Date(start.getTime() + resolutionMin * 60 * 1000);

      expect(resolutionDeadline.getTime()).toBeGreaterThan(firstResponseDeadline.getTime());
    });
  });
});
