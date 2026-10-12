/** One re-check's planned trade for a symbol. */
export interface PlannedOrder {
  s: string;
  /** Shares to buy (+) or sell (−). */
  delta: number;
  why: string;
  /** Still in the targets (only resized, not leaving). */
  wanted: boolean;
}

/**
 * trim: what to do with a stock that stays in the picks but drifted from its
 * target weight. 0 = resize it both ways (sell a winner down, top a loser up);
 * 1 = never sell part of it (a sale realizes a taxable gain), top-ups allowed;
 * 2 = leave it as it is either way. Exits, new buys and the safe asset are
 * always traded.
 */
export function applyTrim(
  orders: PlannedOrder[],
  trim: number,
  held: (s: string) => boolean,
  safe: string | undefined,
): PlannedOrder[] {
  if (trim <= 0) return orders;
  return orders.filter((o) => {
    if (o.s === safe || !o.wanted || !held(o.s)) return true;
    if (o.delta < 0) return false;
    return trim < 2;
  });
}
