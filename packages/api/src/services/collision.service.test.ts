import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  recordHeartbeat,
  getViewers,
  removeViewer,
  _clearStore,
  _getStoreSize,
} from './collision.service.js';

describe('Collision Service', () => {
  beforeEach(() => {
    _clearStore();
    vi.useRealTimers();
  });

  describe('recordHeartbeat', () => {
    it('should return empty array when user is the only viewer', () => {
      const result = recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      expect(result).toEqual([]);
    });

    it('should return other viewers when multiple agents view the same ticket', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      const result = recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', true);

      expect(result).toHaveLength(1);
      const viewer = result[0]!;
      expect(viewer).toMatchObject({
        user_id: 'user-1',
        full_name: 'Agent Alice',
        is_composing: false,
      });
      expect(viewer.last_seen_at).toBeDefined();
    });

    it('should update existing viewer entry on subsequent heartbeats', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', true);

      const viewers = getViewers('ticket-1');
      expect(viewers).toHaveLength(1);
      expect(viewers[0]!.is_composing).toBe(true);
    });

    it('should not include the calling user in the returned viewers', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', false);
      const result = recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);

      expect(result).toHaveLength(1);
      expect(result[0]!.user_id).toBe('user-2');
    });

    it('should prune stale entries beyond TTL', () => {
      vi.useFakeTimers();
      _clearStore();

      vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);

      // Advance time by 16 seconds (beyond 15s TTL)
      vi.setSystemTime(new Date('2026-03-04T10:00:16Z'));

      // Now user-2 sends a heartbeat -- user-1 should be pruned
      const result = recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', false);
      expect(result).toEqual([]);

      vi.useRealTimers();
    });

    it('should keep entries within TTL', () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);

      // Advance time by 10 seconds (within 15s TTL)
      vi.setSystemTime(new Date('2026-03-04T10:00:10Z'));

      const result = recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', false);
      expect(result).toHaveLength(1);
      expect(result[0]!.user_id).toBe('user-1');

      vi.useRealTimers();
    });

    it('should handle multiple tickets independently', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-2', 'user-2', 'Agent Bob', false);

      const viewers1 = getViewers('ticket-1');
      const viewers2 = getViewers('ticket-2');

      expect(viewers1).toHaveLength(1);
      expect(viewers1[0]!.user_id).toBe('user-1');
      expect(viewers2).toHaveLength(1);
      expect(viewers2[0]!.user_id).toBe('user-2');
    });
  });

  describe('getViewers', () => {
    it('should return empty array for unknown ticket', () => {
      const result = getViewers('nonexistent-ticket');
      expect(result).toEqual([]);
    });

    it('should return all viewers when no excludeUserId is provided', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', true);

      const result = getViewers('ticket-1');
      expect(result).toHaveLength(2);
    });

    it('should exclude specified user', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', true);

      const result = getViewers('ticket-1', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.user_id).toBe('user-2');
    });

    it('should prune stale entries on read', () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);

      vi.setSystemTime(new Date('2026-03-04T10:00:16Z'));
      const result = getViewers('ticket-1');
      expect(result).toEqual([]);

      vi.useRealTimers();
    });
  });

  describe('removeViewer', () => {
    it('should remove a viewer from a ticket', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-1', 'user-2', 'Agent Bob', false);

      removeViewer('ticket-1', 'user-1');

      const viewers = getViewers('ticket-1');
      expect(viewers).toHaveLength(1);
      expect(viewers[0]!.user_id).toBe('user-2');
    });

    it('should clean up ticket entry when last viewer is removed', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      removeViewer('ticket-1', 'user-1');

      expect(_getStoreSize('ticket-1')).toBe(0);
      expect(_getStoreSize()).toBe(0);
    });

    it('should handle removing a non-existent viewer gracefully', () => {
      expect(() => removeViewer('ticket-1', 'user-1')).not.toThrow();
    });

    it('should handle removing from non-existent ticket gracefully', () => {
      expect(() => removeViewer('nonexistent', 'user-1')).not.toThrow();
    });
  });

  describe('_clearStore', () => {
    it('should remove all entries', () => {
      recordHeartbeat('ticket-1', 'user-1', 'Agent Alice', false);
      recordHeartbeat('ticket-2', 'user-2', 'Agent Bob', false);

      _clearStore();

      expect(_getStoreSize()).toBe(0);
    });
  });
});
