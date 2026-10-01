const ET = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * The New York date (YYYY-MM-DD) whose close first knows about something
 * published at `t`: the same day before 16:00, the next calendar day after.
 * (Weekends and holidays roll into the next trading bar when attached.)
 */
export function sessionDay(t: Date): string {
  const parts = Object.fromEntries(
    ET.formatToParts(t).map((p) => [p.type, p.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) < 16) return day;
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Published outside the session (after 16:00 or before 09:30 New York): news the next open knows but the last close didn't. */
export function beforeOpen(t: Date): boolean {
  const parts = Object.fromEntries(
    ET.formatToParts(t).map((p) => [p.type, p.value]),
  );
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 16 * 60 || minutes < 9 * 60 + 30;
}

/** The New York date of a daily bar (Alpaca dates them at 00:00 New York time). */
export const barDay = (t: Date) =>
  sessionDay(new Date(t.getTime() + 12 * 3_600_000));
