import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollisionBanner } from '../../components/features/tickets/CollisionBanner.js';
import type { HeartbeatViewer } from '@busybirdies/shared';

describe('CollisionBanner', () => {
  it('should render nothing when there are no viewers', () => {
    const { container } = render(<CollisionBanner viewers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should show a single viewer name', () => {
    const viewers: HeartbeatViewer[] = [
      {
        user_id: 'user-1',
        full_name: 'Alice Smith',
        is_composing: false,
        last_seen_at: '2026-03-04T10:00:00Z',
      },
    ];

    render(<CollisionBanner viewers={viewers} />);
    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/is also viewing this ticket/)).toBeInTheDocument();
  });

  it('should show two viewer names with "and"', () => {
    const viewers: HeartbeatViewer[] = [
      {
        user_id: 'user-1',
        full_name: 'Alice Smith',
        is_composing: false,
        last_seen_at: '2026-03-04T10:00:00Z',
      },
      {
        user_id: 'user-2',
        full_name: 'Bob Jones',
        is_composing: false,
        last_seen_at: '2026-03-04T10:00:00Z',
      },
    ];

    render(<CollisionBanner viewers={viewers} />);
    expect(screen.getByText(/Alice Smith and Bob Jones/)).toBeInTheDocument();
    expect(screen.getByText(/are also viewing this ticket/)).toBeInTheDocument();
  });

  it('should indicate when a viewer is composing', () => {
    const viewers: HeartbeatViewer[] = [
      {
        user_id: 'user-1',
        full_name: 'Alice Smith',
        is_composing: true,
        last_seen_at: '2026-03-04T10:00:00Z',
      },
    ];

    render(<CollisionBanner viewers={viewers} />);
    expect(screen.getByText(/is typing/)).toBeInTheDocument();
  });

  it('should have role="status" for accessibility', () => {
    const viewers: HeartbeatViewer[] = [
      {
        user_id: 'user-1',
        full_name: 'Alice Smith',
        is_composing: false,
        last_seen_at: '2026-03-04T10:00:00Z',
      },
    ];

    render(<CollisionBanner viewers={viewers} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have data-testid for testing', () => {
    const viewers: HeartbeatViewer[] = [
      {
        user_id: 'user-1',
        full_name: 'Alice Smith',
        is_composing: false,
        last_seen_at: '2026-03-04T10:00:00Z',
      },
    ];

    render(<CollisionBanner viewers={viewers} />);
    expect(screen.getByTestId('collision-banner')).toBeInTheDocument();
  });
});
