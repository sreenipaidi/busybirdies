import type { HeartbeatViewer } from '@supportdesk/shared';

interface CollisionBannerProps {
  /** List of other agents currently viewing the ticket. */
  viewers: HeartbeatViewer[];
}

/**
 * Banner displayed at the top of a ticket detail page when other agents
 * are currently viewing the same ticket (collision detection).
 * Shows the names of other viewers and indicates if any are composing.
 */
export function CollisionBanner({ viewers }: CollisionBannerProps) {
  if (!viewers || viewers.length === 0) {
    return null;
  }

  const composingViewers = viewers.filter((v) => v.is_composing);

  const names = viewers.map((v) => v.full_name);
  const viewerText =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-md border border-warning bg-warning/10 px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="collision-banner"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 flex-shrink-0 text-warning"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
      <div className="flex-1 text-sm text-text-primary">
        <span className="font-medium">{viewerText}</span>
        {viewers.length === 1 ? ' is' : ' are'} also viewing this ticket
        {composingViewers.length > 0 && (
          <span className="text-text-secondary">
            {' '}
            ({composingViewers.map((v) => v.full_name).join(', ')}{' '}
            {composingViewers.length === 1 ? 'is' : 'are'} typing)
          </span>
        )}
      </div>
    </div>
  );
}
