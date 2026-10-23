import { cleanQty } from '../strategies/qty.js';

/** A stock the Alpaca account holds (long shares). */
export interface AccountHolding {
  symbol: string;
  qty: number;
  /** Alpaca's average buy price. */
  avgPrice: number;
  /** The latest price. */
  price: number;
}

/** A change My stocks needs to match the account. */
export interface SyncChange {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
}

/**
 * What the Trade page's "My stocks" must change to match the Alpaca account:
 * the account's shares minus the investments' are yours. Symbols with an
 * order on the way (`busy`) are left alone (their shares are still moving),
 * and so are shares the investments claim beyond what the account holds.
 */
export function syncChanges(input: {
  account: AccountHolding[];
  /** Shares per symbol in the investments' ledgers. */
  investments: Record<string, number>;
  /** Shares per symbol in My stocks (with their average price). */
  mine: Record<string, { qty: number; avgPrice: number }>;
  busy: Set<string>;
}): { changes: SyncChange[]; skipped: string[] } {
  const held = new Map(input.account.map((h) => [h.symbol, h]));
  const symbols = [
    ...new Set([...held.keys(), ...Object.keys(input.mine)]),
  ].sort();
  const changes: SyncChange[] = [];
  const skipped: string[] = [];
  for (const symbol of symbols) {
    const h = held.get(symbol);
    const mine = input.mine[symbol];
    const target = Math.max(
      0,
      cleanQty((h?.qty ?? 0) - (input.investments[symbol] ?? 0)),
    );
    const diff = cleanQty(target - (mine?.qty ?? 0));
    if (Math.abs(diff) < 1e-6) continue;
    if (input.busy.has(symbol)) {
      skipped.push(symbol);
      continue;
    }
    changes.push(
      diff > 0
        ? { symbol, side: 'buy', qty: diff, price: h?.avgPrice ?? 0 }
        : {
            symbol,
            side: 'sell',
            qty: -diff,
            price: h?.price ?? mine?.avgPrice ?? 0,
          },
    );
  }
  return { changes, skipped };
}

/**
 * When the shares you hold were bought: going back through the filled buys
 * (newest first) until they add up to `qty`, the oldest one needed. Null when
 * the buys aren't found (e.g. older than the orders looked at).
 */
export function boughtSince(
  buys: Array<{ qty: number; at: Date }>,
  qty: number,
): Date | null {
  let left = qty;
  const newestFirst = [...buys].sort((a, b) => b.at.getTime() - a.at.getTime());
  for (const b of newestFirst) {
    left -= b.qty;
    if (left <= 1e-6) return b.at;
  }
  return newestFirst.at(-1)?.at ?? null;
}
