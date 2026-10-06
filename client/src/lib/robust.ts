import type { ProfileRobustness } from '../api/broker-types';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`;

/** "+15% to +18%": the usual yearly return in the tests. */
export const usualRange = (r: ProfileRobustness) =>
  `${pct(r.usualPct[0])} to ${pct(r.usualPct[1])}`;

/** Whether beating SPY in the tests was more than luck (a t-statistic of 2 or more). */
export function vsSpy(r: ProfileRobustness): { text: string; color: string } {
  if (r.tVsSpy >= 2) return { text: 'Beat SPY by more than luck', color: 'teal' };
  if (r.tVsSpy >= 1) return { text: 'Ahead of SPY, but it could be luck', color: 'yellow' };
  return { text: 'About the same return as SPY (its plus: smaller drops)', color: 'dimmed' };
}

/** "2013-19: +16% (SPY +14%)". */
export const periodText = (p: ProfileRobustness['periods'][number]) =>
  `${p.from}–${String(p.to).slice(2)}: ${pct(p.pct)} (SPY ${pct(p.spyPct)})`;
