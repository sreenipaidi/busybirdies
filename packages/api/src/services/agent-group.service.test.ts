import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  getAgentGroup,
  createAgentGroup,
  updateAgentGroup,
  deleteAgentGroup,
  addMember,
  removeMember,
} from './agent-group.service.js';
import { getDb } from '../db/connection.js';

// ---------------------------------------------------------------------------
// Mock DB helper
// ---------------------------------------------------------------------------

function createMockDb() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return chainable;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAgentGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new agent group', async () => {
    const mockDb = createMockDb();
    // First query: check for duplicate name
    let selectCallCount = 0;
    mockDb.limit.mockImplementation(() => {
      selectCallCount++;
      return Promise.resolve([]);
    });
    // Insert returning
    mockDb.returning.mockResolvedValue([
      {
        id: 'group-1',
        name: 'Support L1',
        description: 'First level support',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await createAgentGroup('tenant-1', {
      name: 'Support L1',
      description: 'First level support',
    });

    expect(result.id).toBe('group-1');
    expect(result.name).toBe('Support L1');
    expect(result.description).toBe('First level support');
    expect(result.member_count).toBe(0);
    expect(result.members).toEqual([]);
  });

  it('should throw ConflictError when name already exists', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([{ id: 'existing-group' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      createAgentGroup('tenant-1', { name: 'Existing Group' }),
    ).rejects.toThrow('An agent group with this name already exists');
  });
});

describe('getAgentGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NotFoundError when group does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(getAgentGroup('tenant-1', 'nonexistent')).rejects.toThrow(
      'Agent group not found',
    );
  });
});

describe('deleteAgentGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NotFoundError when group does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(deleteAgentGroup('tenant-1', 'nonexistent')).rejects.toThrow(
      'Agent group not found',
    );
  });

  it('should delete the group when it exists', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([{ id: 'group-1' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(deleteAgentGroup('tenant-1', 'group-1')).resolves.toBeUndefined();
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe('updateAgentGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NotFoundError when group does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      updateAgentGroup('tenant-1', 'nonexistent', { name: 'New Name' }),
    ).rejects.toThrow('Agent group not found');
  });

  it('should throw ConflictError when renaming to an existing name', async () => {
    const mockDb = createMockDb();
    let callCount = 0;
    mockDb.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Group exists check
        return Promise.resolve([{ id: 'group-1', name: 'Old Name' }]);
      }
      // Duplicate name check
      return Promise.resolve([{ id: 'group-2' }]);
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      updateAgentGroup('tenant-1', 'group-1', { name: 'Existing Name' }),
    ).rejects.toThrow('An agent group with this name already exists');
  });
});

describe('addMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NotFoundError when group does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      addMember('tenant-1', 'nonexistent', { user_id: 'user-1' }),
    ).rejects.toThrow('Agent group not found');
  });

  it('should throw NotFoundError when user does not exist', async () => {
    const mockDb = createMockDb();
    let callCount = 0;
    mockDb.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Group exists
        return Promise.resolve([{ id: 'group-1' }]);
      }
      // User not found
      return Promise.resolve([]);
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      addMember('tenant-1', 'group-1', { user_id: 'nonexistent-user' }),
    ).rejects.toThrow('User not found');
  });

  it('should throw validation error when user is a client', async () => {
    const mockDb = createMockDb();
    let callCount = 0;
    mockDb.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{ id: 'group-1' }]);
      }
      if (callCount === 2) {
        return Promise.resolve([{ id: 'user-1', role: 'client' }]);
      }
      return Promise.resolve([]);
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      addMember('tenant-1', 'group-1', { user_id: 'user-1' }),
    ).rejects.toThrow('Only agents and admins can be added to groups');
  });

  it('should throw ConflictError when user is already a member', async () => {
    const mockDb = createMockDb();
    let callCount = 0;
    mockDb.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{ id: 'group-1' }]);
      }
      if (callCount === 2) {
        return Promise.resolve([{ id: 'user-1', role: 'agent' }]);
      }
      // Already a member
      return Promise.resolve([{ id: 'membership-1' }]);
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      addMember('tenant-1', 'group-1', { user_id: 'user-1' }),
    ).rejects.toThrow('User is already a member of this group');
  });
});

describe('removeMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NotFoundError when group does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      removeMember('tenant-1', 'nonexistent', 'user-1'),
    ).rejects.toThrow('Agent group not found');
  });

  it('should throw NotFoundError when membership does not exist', async () => {
    const mockDb = createMockDb();
    let callCount = 0;
    mockDb.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{ id: 'group-1' }]);
      }
      // Membership not found
      return Promise.resolve([]);
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      removeMember('tenant-1', 'group-1', 'user-not-member'),
    ).rejects.toThrow('Group membership not found');
  });
});
