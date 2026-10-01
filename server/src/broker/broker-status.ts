import type { ManualLevels } from '../paper/deployment.types.js';

const usd = (n: number) => `$${n.toFixed(2)}`;

export interface Ranks {
  total: number;
  rank: Record<string, number>;
  /** What the algo would hold now. */
  wanted: string[];
}

export type StatusTone = 'good' | 'watch' | 'danger' | 'neutral';

/** One holding's status in plain words, and its sell levels (yours win when higher / lower). */
export function holdingStatus(input: {
  symbol: string;
  price: number;
  autoStop: number | null;
  autoTake: number | null;
  manual: ManualLevels | undefined;
  ranks: Ranks | null;
  selling: boolean;
  safe: boolean;
}) {
  const { symbol, price, ranks, manual } = input;
  const mineStop = manual?.stopPrice ?? null;
  const mineTake = manual?.takeProfitPrice ?? null;
  const stopPrice = Math.max(input.autoStop ?? 0, mineStop ?? 0) || null;
  const takeProfitPrice = mineTake ?? input.autoTake;
  const levels = {
    stopPrice,
    stopIsYours: mineStop !== null && mineStop >= (input.autoStop ?? 0),
    takeProfitPrice,
    takeIsYours: mineTake !== null,
  };
  const rank = ranks?.rank[symbol] ?? null;
  const of = ranks ? ` of ${ranks.total}` : '';
  const status = (tone: StatusTone, label: string, text: string) => ({
    ...levels,
    rank,
    tone,
    label,
    text,
  });
  if (input.selling)
    return status(
      'watch',
      'Selling',
      'The sell order fills at the market (or the next open).',
    );
  if (input.safe)
    return status(
      'neutral',
      'Parked',
      'Waiting in T-bills until more stocks are rising.',
    );
  if (stopPrice !== null && price <= stopPrice * 1.05)
    return status(
      'danger',
      'Near stop',
      `Within 5% of its stop: it sells if a close is below ${usd(stopPrice)}.`,
    );
  if (takeProfitPrice !== null && price >= takeProfitPrice * 0.97)
    return status(
      'good',
      'Near target',
      `Within 3% of the profit target ${usd(takeProfitPrice)}.`,
    );
  if (ranks && rank !== null && !ranks.wanted.includes(symbol))
    return status(
      'watch',
      'Weakening',
      `Now #${rank}${of}: it is sold at the next weekly check unless it climbs back into the top.`,
    );
  if (rank !== null)
    return status(
      'good',
      'Strong',
      `#${rank}${of}: still one of the strongest, so it keeps holding it.`,
    );
  return status('neutral', 'Holding', 'Holding it.');
}
