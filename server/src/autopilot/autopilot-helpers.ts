import type { AutopilotRun } from './autopilot.types.js';

/** The next `count` watchlist symbols from `start`, skipping `skip`; and where to continue. */
export function nextSymbols(
  watchlist: string[],
  start: number,
  count: number,
  skip: Set<string>,
) {
  const picked: string[] = [];
  let i = start;
  for (
    let seen = 0;
    seen < watchlist.length && picked.length < count;
    seen++, i++
  ) {
    const symbol = watchlist[i % watchlist.length];
    if (!skip.has(symbol)) picked.push(symbol);
  }
  return { picked, next: watchlist.length ? i % watchlist.length : 0 };
}

/** A run as a short message: what changed (kept deployments aren't news). */
export function runSummary(run: AutopilotRun): string {
  const worth = run.decisions.filter((d) => d.kind !== 'kept');
  const lines = worth.length
    ? worth.map((d) => `• ${d.message}`)
    : ['• nothing to change'];
  return [
    `Autopilot run ${run.status}${run.error ? `: ${run.error}` : ''}`,
    ...lines,
  ].join('\n');
}

const DAY_MS = 86_400_000;

/** When the next scheduled run is due (null: now, it never ran). */
export function nextRunAt(
  lastRunAt: Date | null,
  everyDays: number,
): Date | null {
  return lastRunAt
    ? new Date(new Date(lastRunAt).getTime() + everyDays * DAY_MS)
    : null;
}
