const HOUR_MS = 3_600_000;

/**
 * Daily bars dated before this are complete. Alpaca dates a daily bar at
 * 00:00 New York time of its session: during a session, today's bar (00:00,
 * 16 h before the 16:00 close) is still forming; when the market is closed,
 * every bar before the next session (00:00, 9.5 h before the 09:30 open) is done.
 */
export function completedBefore(clock: {
  isOpen: boolean;
  nextOpen: Date;
  nextClose: Date;
}): Date {
  return clock.isOpen
    ? new Date(new Date(clock.nextClose).getTime() - 16 * HOUR_MS)
    : new Date(new Date(clock.nextOpen).getTime() - 9.5 * HOUR_MS);
}
