import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { HeartbeatViewer } from '@supportdesk/shared';

/** Interval in milliseconds between heartbeat requests. */
const HEARTBEAT_INTERVAL_MS = 10_000;

/** Interval in milliseconds between viewer polling requests. */
const POLL_INTERVAL_MS = 10_000;

/** Response shape from the heartbeat endpoint. */
interface HeartbeatResponse {
  other_viewers: HeartbeatViewer[];
}

/**
 * Hook that manages collision detection for a ticket.
 * Sends heartbeats every 10 seconds and polls for other viewers.
 *
 * @param ticketId - The ticket being viewed (empty string or undefined to disable)
 * @returns Object containing other viewers and the composing state setter
 */
export function useCollisionDetection(ticketId: string | undefined) {
  const [otherViewers, setOtherViewers] = useState<HeartbeatViewer[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const isComposingRef = useRef(false);

  // Keep the ref in sync with state so the interval callback uses the latest value
  useEffect(() => {
    isComposingRef.current = isComposing;
  }, [isComposing]);

  const sendHeartbeat = useCallback(async () => {
    if (!ticketId) return;

    try {
      const response = await api.post<HeartbeatResponse>(
        ENDPOINTS.tickets.heartbeat(ticketId),
        { is_composing: isComposingRef.current },
      );
      setOtherViewers(response.other_viewers ?? []);
    } catch {
      // Silently ignore heartbeat failures -- they are non-critical
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) {
      setOtherViewers([]);
      return;
    }

    // Send initial heartbeat immediately
    void sendHeartbeat();

    // Set up periodic heartbeat
    const intervalId = setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      setOtherViewers([]);
    };
  }, [ticketId, sendHeartbeat]);

  return {
    /** List of other agents currently viewing this ticket. */
    otherViewers,
    /** Set whether the current user is composing a reply. */
    setIsComposing,
    /** Whether the current user is composing. */
    isComposing,
  };
}

export type { HeartbeatViewer };
export { HEARTBEAT_INTERVAL_MS, POLL_INTERVAL_MS };
