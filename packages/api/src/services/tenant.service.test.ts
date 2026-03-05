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

import { getTenant, updateTenant, getPortalConfig } from './tenant.service.js';
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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return chainable;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return tenant data when found', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Acme Corp',
        subdomain: 'acme',
        logoUrl: 'https://example.com/logo.png',
        brandColor: '#FF0000',
        supportEmail: 'support@acme.com',
        businessHoursStart: '09:00',
        businessHoursEnd: '17:00',
        businessHoursTimezone: 'UTC',
        businessHoursDays: '1,2,3,4,5',
        teamLeadEmail: 'lead@acme.com',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await getTenant('tenant-1');

    expect(result.id).toBe('tenant-1');
    expect(result.name).toBe('Acme Corp');
    expect(result.subdomain).toBe('acme');
    expect(result.brand_color).toBe('#FF0000');
    expect(result.support_email).toBe('support@acme.com');
    expect(result.business_hours_start).toBe('09:00');
    expect(result.team_lead_email).toBe('lead@acme.com');
  });

  it('should throw NotFoundError when tenant does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(getTenant('nonexistent')).rejects.toThrow('Tenant not found');
  });

  it('should use default brand_color when null', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Test',
        subdomain: 'test',
        logoUrl: null,
        brandColor: null,
        supportEmail: 'test@test.com',
        businessHoursStart: '09:00',
        businessHoursEnd: '17:00',
        businessHoursTimezone: 'UTC',
        businessHoursDays: '1,2,3,4,5',
        teamLeadEmail: null,
        createdAt: new Date(),
      },
    ]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await getTenant('tenant-1');
    expect(result.brand_color).toBe('#2563EB');
    expect(result.logo_url).toBeNull();
  });
});

describe('updateTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NotFoundError when tenant does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      updateTenant('nonexistent', { name: 'New Name' }),
    ).rejects.toThrow('Tenant not found');
  });

  it('should call db.update with the correct values', async () => {
    const mockDb = createMockDb();
    // First call: verify tenant exists
    // Second call: getTenant after update
    let callCount = 0;
    mockDb.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{ id: 'tenant-1' }]);
      }
      return Promise.resolve([
        {
          id: 'tenant-1',
          name: 'Updated Name',
          subdomain: 'acme',
          logoUrl: null,
          brandColor: '#FF0000',
          supportEmail: 'support@acme.com',
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          businessHoursTimezone: 'UTC',
          businessHoursDays: '1,2,3,4,5',
          teamLeadEmail: null,
          createdAt: new Date(),
        },
      ]);
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await updateTenant('tenant-1', { name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalled();
  });
});

describe('getPortalConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return portal config for a valid subdomain', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([
      {
        name: 'Acme Corp',
        logoUrl: 'https://example.com/logo.png',
        brandColor: '#FF0000',
      },
    ]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await getPortalConfig('acme');

    expect(result.name).toBe('Acme Corp');
    expect(result.logo_url).toBe('https://example.com/logo.png');
    expect(result.brand_color).toBe('#FF0000');
  });

  it('should throw NotFoundError when subdomain does not exist', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(getPortalConfig('nonexistent')).rejects.toThrow('Portal not found');
  });
});
