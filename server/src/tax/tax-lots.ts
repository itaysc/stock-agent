/** A buy or sell as stored (see TaxRecord), with its shekel rate. */
export interface TradeRecord {
  activityId: string;
  kind: 'buy' | 'sell';
  at: Date;
  day: string;
  symbol: string;
  qty: number;
  priceUsd: number;
  /** Shekels per dollar on `day`. */
  usdIls: number;
}

/** One sale, matched to the buys it came from (first in, first out). */
export interface Sale {
  symbol: string;
  /** YYYY-MM-DD */
  soldOn: string;
  qty: number;
  /** Buy days of the shares sold (earliest first). */
  boughtOn: string[];
  proceedsUsd: number;
  costUsd: number;
  proceedsIls: number;
  /** Each lot's dollars at the rate of its own buy day. */
  costIls: number;
  saleRate: number;
  gainUsd: number;
  /** Shekels in minus shekels out. */
  gainIls: number;
  /**
   * The dollar gain at the sale day's rate: for stocks bought in dollars,
   * Israel usually treats the part of the gain that only comes from the
   * dollar's move as inflationary (ask your accountant which applies).
   */
  realGainIls: number;
  /** Shares sold that had no recorded buy (e.g. bought before the records start). */
  unmatchedQty: number;
}

/** Shares still held from one buy. */
export interface OpenLot {
  symbol: string;
  boughtOn: string;
  qty: number;
  priceUsd: number;
  usdIls: number;
}

const EPS = 1e-9;

/**
 * Matches every sell to the earliest buys of the same stock still held
 * (FIFO), across all the records given (all years: a sale in 2027 can use a
 * 2026 buy). Returns each sale and the lots still held at the end.
 */
export function matchLots(trades: TradeRecord[]): {
  sales: Sale[];
  open: OpenLot[];
} {
  const sorted = [...trades].sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      a.activityId.localeCompare(b.activityId),
  );
  const lots = new Map<string, OpenLot[]>();
  const sales: Sale[] = [];
  for (const t of sorted) {
    const held = lots.get(t.symbol) ?? [];
    lots.set(t.symbol, held);
    if (t.kind === 'buy') {
      held.push({
        symbol: t.symbol,
        boughtOn: t.day,
        qty: t.qty,
        priceUsd: t.priceUsd,
        usdIls: t.usdIls,
      });
      continue;
    }
    let left = t.qty;
    let costUsd = 0;
    let costIls = 0;
    const boughtOn = new Set<string>();
    while (left > EPS && held.length) {
      const lot = held[0];
      const take = Math.min(left, lot.qty);
      costUsd += take * lot.priceUsd;
      costIls += take * lot.priceUsd * lot.usdIls;
      boughtOn.add(lot.boughtOn);
      lot.qty -= take;
      left -= take;
      if (lot.qty <= EPS) held.shift();
    }
    const unmatchedQty = left > EPS ? left : 0;
    const proceedsUsd = t.qty * t.priceUsd;
    // Shares without a recorded buy: no cost known, so they count at their sale price (no gain, no loss).
    const fill = unmatchedQty * t.priceUsd;
    const gainUsd = proceedsUsd - costUsd - fill;
    sales.push({
      symbol: t.symbol,
      soldOn: t.day,
      qty: t.qty,
      boughtOn: [...boughtOn].sort(),
      proceedsUsd,
      costUsd: costUsd + fill,
      proceedsIls: proceedsUsd * t.usdIls,
      costIls: costIls + fill * t.usdIls,
      saleRate: t.usdIls,
      gainUsd,
      gainIls: proceedsUsd * t.usdIls - costIls - fill * t.usdIls,
      realGainIls: gainUsd * t.usdIls,
      unmatchedQty,
    });
  }
  const open = [...lots.values()].flat().filter((l) => l.qty > EPS);
  return { sales, open };
}
