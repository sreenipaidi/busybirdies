import type { HeartbeatViewer } from '@busybirdies/shared';
import { getLogger } from '../lib/logger.js';

/** TTL in milliseconds -- viewers are removed if no heartbeat within this period. */
const VIEWER_TTL_MS = 15_000;

/** Shape of an entry stored in the in-memory viewer map. */
interface ViewerEntry {
  userId: string;
  fullName: string;
  isComposing: boolean;
  lastSeenAt: Date;
}

/**
 * In-memory store for ticket viewers.
 * Key: ticketId, Value: Map of userId -> ViewerEntry
 */
const viewerStore = new Map<string, Map<string, ViewerEntry>>();

/**
 * Record a heartbeat for a viewer on a ticket.
 * Creates or updates the viewer entry with the current timestamp.
 * Also prunes stale entries for this ticket.
 *
 * @param ticketId - The ticket being viewed
 * @param userId - The user sending the heartbeat
 * @param fullName - Display name of the user
 * @param isComposing - Whether the user is currently typing
 * @returns Array of other viewers (excluding the caller) whose heartbeat is still valid
 */
export function recordHeartbeat(
  ticketId: string,
  userId: string,
  fullName: string,
  isComposing: boolean,
): HeartbeatViewer[] {
  const logger = getLogger();
  const now = new Date();

  // Ensure a sub-map exists for this ticket
  let ticketViewers = viewerStore.get(ticketId);
  if (!ticketViewers) {
    ticketViewers = new Map<string, ViewerEntry>();
    viewerStore.set(ticketId, ticketViewers);
  }

  // Upsert the caller's entry
  ticketViewers.set(userId, {
    userId,
    fullName,
    isComposing,
    lastSeenAt: now,
  });

  // Prune stale entries
  const cutoff = new Date(now.getTime() - VIEWER_TTL_MS);
  for (const [uid, entry] of ticketViewers) {
    if (entry.lastSeenAt < cutoff) {
      ticketViewers.delete(uid);
      logger.info({ ticketId, userId: uid }, 'Pruned stale viewer entry');
    }
  }

  // If the ticket has no viewers left, clean up the outer map
  if (ticketViewers.size === 0) {
    viewerStore.delete(ticketId);
  }

  // Build the list of *other* active viewers
  const otherViewers: HeartbeatViewer[] = [];
  for (const [uid, entry] of ticketViewers) {
    if (uid !== userId) {
      otherViewers.push({
        user_id: entry.userId,
        full_name: entry.fullName,
        is_composing: entry.isComposing,
        last_seen_at: entry.lastSeenAt.toISOString(),
      });
    }
  }

  return otherViewers;
}

/**
 * Get the list of active viewers for a ticket.
 * Prunes stale entries before returning.
 *
 * @param ticketId - The ticket to query
 * @param excludeUserId - Optional user ID to exclude from the results (the caller)
 * @returns Array of active viewers
 */
export function getViewers(
  ticketId: string,
  excludeUserId?: string,
): HeartbeatViewer[] {
  const now = new Date();
  const ticketViewers = viewerStore.get(ticketId);

  if (!ticketViewers) {
    return [];
  }

  // Prune stale entries
  const cutoff = new Date(now.getTime() - VIEWER_TTL_MS);
  for (const [uid, entry] of ticketViewers) {
    if (entry.lastSeenAt < cutoff) {
      ticketViewers.delete(uid);
    }
  }

  if (ticketViewers.size === 0) {
    viewerStore.delete(ticketId);
    return [];
  }

  const viewers: HeartbeatViewer[] = [];
  for (const [uid, entry] of ticketViewers) {
    if (uid !== excludeUserId) {
      viewers.push({
        user_id: entry.userId,
        full_name: entry.fullName,
        is_composing: entry.isComposing,
        last_seen_at: entry.lastSeenAt.toISOString(),
      });
    }
  }

  return viewers;
}

/**
 * Remove a specific viewer from a ticket.
 * Useful when an agent explicitly navigates away.
 *
 * @param ticketId - The ticket
 * @param userId - The user to remove
 */
export function removeViewer(ticketId: string, userId: string): void {
  const ticketViewers = viewerStore.get(ticketId);
  if (!ticketViewers) return;

  ticketViewers.delete(userId);

  if (ticketViewers.size === 0) {
    viewerStore.delete(ticketId);
  }
}

/**
 * Clear the entire in-memory store.
 * Only intended for use in tests.
 */
export function _clearStore(): void {
  viewerStore.clear();
}

/**
 * Get the raw viewer count for a ticket.
 * Only intended for use in tests.
 */
export function _getStoreSize(ticketId?: string): number {
  if (ticketId) {
    return viewerStore.get(ticketId)?.size ?? 0;
  }
  return viewerStore.size;
}
