/**
 * A plain-words "bottom line" for any result: a 0-100 score, what the money
 * would have done, and how much to trust it. No jargon, no AI.
 */

export interface BottomLineInput {
  /** What was tested, e.g. "sma-crossover". */
  name: string;
  symbols: string[];
  from: string;
  to: string;
  startCash: number;
  endCash: number;
  /** Buy & hold's total return over the same time, in percent. */
  holdReturnPct: number | null;
  /** Worst fall from a peak, in percent (positive). */
  worstDropPct: number;
  holdWorstDropPct: number | null;
  trades: number;
  winRatePct: number | null;
  /** True when judged on data the settings were not picked on (walk-forward, holdout). */
  unseen: boolean;
  /** True when the settings were picked with hindsight on this same data (best of a sweep). */
  hindsight?: boolean;
  /** Interest earned on idle cash, when known (already part of endCash). */
  interestEarned?: number;
}

export type Trust = 'low' | 'medium' | 'high';

export interface BottomLine {
  score: number;
  grade: 'Poor' | 'Weak' | 'Okay' | 'Good' | 'Great';
  color: string;
  verdict: string;
  gain: number;
  gainPct: number;
  holdEnd: number | null;
  /** Strategy's end money minus holding's. */
  vsHold: number | null;
  trust: Trust;
  trustWhy: string;
  years: number;
}

const YEAR_MS = 365.25 * 86_400_000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Linear from (x0 → y0) to (x1 → y1), clamped. */
const scale = (x: number, x0: number, y0: number, x1: number, y1: number) =>
  y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0), 0, 1);
const annual = (totalPct: number, years: number) =>
  years > 0 ? ((1 + totalPct / 100) ** (1 / years) - 1) * 100 : totalPct;

const GRADES: Array<[number, BottomLine['grade'], string]> = [
  [90, 'Great', 'green'],
  [75, 'Good', 'teal'],
  [60, 'Okay', 'yellow'],
  [40, 'Weak', 'orange'],
  [0, 'Poor', 'red'],
];

/**
 * Score = up to 40 for the yearly return (0% → 15, 20%+ → 40), up to 40 for
 * doing better than just holding (same → 25, 10 points a year better → 40),
 * up to 20 for small drops (5% or less → 20, 30%+ → 0).
 */
export function scoreOf(i: BottomLineInput): number {
  const years = Math.max((new Date(i.to).getTime() - new Date(i.from).getTime()) / YEAR_MS, 1 / 12);
  const returnPct = (i.endCash / i.startCash - 1) * 100;
  const yearly = annual(returnPct, years);
  const returnPoints = yearly < 0 ? scale(yearly, -10, 0, 0, 15) : scale(yearly, 0, 15, 20, 40);
  let holdPoints = 20;
  if (i.holdReturnPct !== null) {
    const edge = yearly - annual(i.holdReturnPct, years);
    holdPoints = edge < 0 ? scale(edge, -15, 0, 0, 25) : scale(edge, 0, 25, 10, 40);
  }
  const riskPoints = scale(i.worstDropPct, 30, 0, 5, 20);
  return Math.round(returnPoints + holdPoints + riskPoints);
}

function trustOf(i: BottomLineInput): { trust: Trust; trustWhy: string } {
  if (i.hindsight) {
    return {
      trust: 'low',
      trustWhy:
        'These are the best settings picked by looking back at this same period, so it looks better than it would have been in real time.',
    };
  }
  if (i.trades < 8) {
    return { trust: 'low', trustWhy: `Only ${i.trades} trades: too few to tell skill from luck.` };
  }
  if (i.unseen && i.trades >= 20) {
    return {
      trust: 'high',
      trustWhy: `Tested on data it wasn't tuned on, with ${i.trades} trades.`,
    };
  }
  return i.unseen
    ? {
        trust: 'medium',
        trustWhy: `Tested on data it wasn't tuned on, but only ${i.trades} trades.`,
      }
    : {
        trust: 'medium',
        trustWhy:
          'Tested with fixed settings on past prices; a walk-forward test would show if it holds up.',
      };
}

export function bottomLine(i: BottomLineInput): BottomLine {
  const years = (new Date(i.to).getTime() - new Date(i.from).getTime()) / YEAR_MS;
  const score = scoreOf(i);
  const [, grade, color] = GRADES.find(([min]) => score >= min) ?? GRADES[GRADES.length - 1];
  const gain = i.endCash - i.startCash;
  const holdEnd = i.holdReturnPct === null ? null : i.startCash * (1 + i.holdReturnPct / 100);
  const vsHold = holdEnd === null ? null : i.endCash - holdEnd;
  const verdict =
    gain < 0
      ? 'Lost money.'
      : vsHold !== null && vsHold < 0
        ? 'Made money, but less than simply buying and holding.'
        : vsHold !== null
          ? 'Made money, and more than simply buying and holding.'
          : 'Made money.';
  return {
    score,
    grade,
    color,
    verdict,
    gain,
    gainPct: (i.endCash / i.startCash - 1) * 100,
    holdEnd,
    vsHold,
    years,
    ...trustOf(i),
  };
}
