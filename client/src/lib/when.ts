/** "16:42" today, "Fri 22:59" on another day. */
export function when(iso: string | Date): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

/** A trading day, e.g. "Fri, Oct 2" (as dated in New York, where the market is). */
export const tradingDay = (iso: string | Date) =>
  new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });
