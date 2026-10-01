import type { ResearchSession } from '../../research/research.types.js';
import type { Idea } from './idea.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const years = (s: ResearchSession) =>
  Math.round(
    (new Date(s.request.to).getTime() - new Date(s.request.from).getTime()) /
      (365.25 * 86_400_000),
  );

/** The setting it would trade, in a few words: "rules (breakout=20 atrStop=3)". */
export function setupText(idea: Pick<Idea, 'sleeve'>): string {
  const params = Object.entries(idea.sleeve.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return `${idea.sleeve.strategy}${params ? ` (${params})` : ''}`;
}

/** The short evidence for an idea: what it would trade, and why. */
export function ideaMessage(
  idea: Pick<Idea, 'id' | 'label' | 'sleeve' | 'capital'>,
  s: ResearchSession,
  days: number,
): string {
  const o = s.holdout?.outcome;
  const why = [
    o &&
      `Hidden final year (never used to pick it): ${pct(o.returnPct)} vs ${pct(o.holdReturnPct)} for just holding`,
    o &&
      `Worst drop: -${o.maxDrawdownPct.toFixed(1)}% vs -${o.holdMaxDrawdownPct.toFixed(1)}% holding`,
    o &&
      `${o.trades} trades${o.winRatePct === null ? '' : `, ${o.winRatePct.toFixed(0)}% winners`}`,
    s.robustness && `Similar symbols: ${s.robustness.summary.verdict}`,
    s.verdict && `AI: ${s.verdict.headline}`,
  ].filter(Boolean);
  return [
    `💡 Idea ${idea.id}: ${idea.label}`,
    `Trades: ${setupText(idea)}`,
    '',
    'Why:',
    ...why.map((w) => `• ${w}`),
    '',
    `Tested: ${s.experiments.length} setups over ${years(s)} years, each picked on past data and scored on the months after (walk-forward).`,
    `How much paper money? Tap Invest to choose (suggested ${money(idea.capital)}), or /invest ${idea.id} 5000. Valid ${days} days.`,
    'Past results, not a promise.',
  ].join('\n');
}
