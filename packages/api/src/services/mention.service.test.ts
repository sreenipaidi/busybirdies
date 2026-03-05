import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  const fromObj = {
    where: () => Promise.resolve(selectResults.shift() ?? []),
  };

  return {
    select: () => ({
      from: () => fromObj,
    }),
    _pushSelectResult: (r: unknown[]) => selectResults.push(r),
  };
}

let mockDb: ReturnType<typeof buildMockDb>;

vi.mock('../db/connection.js', () => ({
  getDb: () => mockDb,
}));

// Import after mocking
import { parseMentions, resolveMentions, processMentions } from './mention.service.js';

describe('Mention Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();
  });

  describe('parseMentions', () => {
    it('should parse a single mention', () => {
      const result = parseMentions('Hey @[Alice Smith], can you look at this?');
      expect(result).toEqual([{ fullName: 'Alice Smith' }]);
    });

    it('should parse multiple mentions', () => {
      const result = parseMentions(
        'CC @[Alice Smith] and @[Bob Jones] on this issue.',
      );
      expect(result).toHaveLength(2);
      expect(result[0]!).toEqual({ fullName: 'Alice Smith' });
      expect(result[1]!).toEqual({ fullName: 'Bob Jones' });
    });

    it('should deduplicate repeated mentions', () => {
      const result = parseMentions(
        '@[Alice Smith] please review. Also @[Alice Smith] can approve.',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!).toEqual({ fullName: 'Alice Smith' });
    });

    it('should return empty array when no mentions exist', () => {
      const result = parseMentions('No mentions here at all.');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseMentions('');
      expect(result).toEqual([]);
    });

    it('should not match incomplete mention syntax', () => {
      const result = parseMentions('This @Alice is not a valid mention');
      expect(result).toEqual([]);
    });

    it('should not match unclosed brackets', () => {
      const result = parseMentions('This @[Alice is not closed');
      expect(result).toEqual([]);
    });

    it('should handle mentions with special characters in names', () => {
      const result = parseMentions("@[O'Brien-Smith Jr.]");
      expect(result).toEqual([{ fullName: "O'Brien-Smith Jr." }]);
    });

    it('should handle mention at start of text', () => {
      const result = parseMentions('@[Alice] please check this');
      expect(result).toEqual([{ fullName: 'Alice' }]);
    });

    it('should handle mention at end of text', () => {
      const result = parseMentions('Please check this @[Alice]');
      expect(result).toEqual([{ fullName: 'Alice' }]);
    });
  });

  describe('resolveMentions', () => {
    it('should return empty array when no mentions provided', async () => {
      const result = await resolveMentions('tenant-1', []);
      expect(result).toEqual([]);
    });

    it('should resolve mentions to user records', async () => {
      mockDb._pushSelectResult([
        {
          id: 'user-1',
          fullName: 'Alice Smith',
          email: 'alice@test.com',
          role: 'agent',
        },
      ]);

      const result = await resolveMentions('tenant-1', [
        { fullName: 'Alice Smith' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]!).toEqual({
        userId: 'user-1',
        fullName: 'Alice Smith',
        email: 'alice@test.com',
        role: 'agent',
      });
    });

    it('should filter out client users from results', async () => {
      mockDb._pushSelectResult([
        {
          id: 'user-1',
          fullName: 'Client User',
          email: 'client@test.com',
          role: 'client',
        },
      ]);

      const result = await resolveMentions('tenant-1', [
        { fullName: 'Client User' },
      ]);

      expect(result).toEqual([]);
    });

    it('should include admin users in results', async () => {
      mockDb._pushSelectResult([
        {
          id: 'user-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          role: 'admin',
        },
      ]);

      const result = await resolveMentions('tenant-1', [
        { fullName: 'Admin User' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('admin');
    });

    it('should return empty array when database query fails', async () => {
      // Override mock to throw
      mockDb.select = () => ({
        from: () => ({
          where: () => Promise.reject(new Error('DB Error')),
        }),
      });

      const result = await resolveMentions('tenant-1', [
        { fullName: 'Alice Smith' },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('processMentions', () => {
    it('should return empty array when no mentions in body', async () => {
      const result = await processMentions(
        'tenant-1',
        'ticket-1',
        'No mentions here.',
        'author-1',
      );
      expect(result).toEqual([]);
    });

    it('should resolve and return mentioned users', async () => {
      mockDb._pushSelectResult([
        {
          id: 'user-1',
          fullName: 'Alice Smith',
          email: 'alice@test.com',
          role: 'agent',
        },
      ]);

      const result = await processMentions(
        'tenant-1',
        'ticket-1',
        'Hey @[Alice Smith], can you check this?',
        'author-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toBe('user-1');
    });

    it('should filter out self-mentions', async () => {
      mockDb._pushSelectResult([
        {
          id: 'author-1',
          fullName: 'Author Agent',
          email: 'author@test.com',
          role: 'agent',
        },
      ]);

      const result = await processMentions(
        'tenant-1',
        'ticket-1',
        'Note to self @[Author Agent]',
        'author-1',
      );

      expect(result).toEqual([]);
    });

    it('should include non-self mentions and exclude self-mentions', async () => {
      mockDb._pushSelectResult([
        {
          id: 'author-1',
          fullName: 'Author Agent',
          email: 'author@test.com',
          role: 'agent',
        },
        {
          id: 'user-2',
          fullName: 'Other Agent',
          email: 'other@test.com',
          role: 'agent',
        },
      ]);

      const result = await processMentions(
        'tenant-1',
        'ticket-1',
        '@[Author Agent] and @[Other Agent] please review',
        'author-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toBe('user-2');
    });
  });
});
