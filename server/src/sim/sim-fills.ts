import type { SimPosition } from './sim.schema.js';

/**
 * An error shaped like the Alpaca SDK's (by `name` and `status`), so the app
 * treats a paper account's refusals the way it treats Alpaca's.
 */
export class SimError extends Error {
  constructor(
    name: 'ValidationError' | 'NotFoundError' | 'ForbiddenError',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = name;
  }
}

const refuse = (message: string) =>
  new SimError('ValidationError', 403, message);

export const cents = (usd: number) => Math.round(usd * 100) / 100;
/** Shares to 9 decimals, as Alpaca keeps fractions. */
export const shares = (qty: number) => Math.round(qty * 1e9) / 1e9;

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  timeInForce: string;
  qty?: number;
  notional?: number;
}

export interface OrderCheck {
  asset: { tradable: boolean; fractionable: boolean } | null;
  /** The latest trade price. */
  price: number;
  /** Cash free to buy with: cash less what waiting buys hold. */
  buyingPower: number;
  /** Shares free to sell: held less what waiting sells take. */
  available: number;
}

/**
 * Checks an order the way Alpaca would for a cash account, and returns the
 * cash it holds while it waits (buys). Market orders only: the app places no
 * other kind.
 */
export function checkOrder(o: OrderRequest, c: OrderCheck): number {
  if (o.type !== 'market')
    throw refuse('Bullwether paper accounts take market orders only');
  if (!c.asset?.tradable) throw refuse(`asset ${o.symbol} is not tradable`);
  const amount = o.notional !== undefined;
  if (amount === (o.qty !== undefined))
    throw refuse('give either qty or notional');
  const size = amount ? o.notional! : o.qty!;
  if (!(size > 0)) throw refuse('qty or notional must be more than 0');
  if (!(c.price > 0)) throw refuse(`no price for ${o.symbol} right now`);
  if ((amount || !Number.isInteger(o.qty)) && !c.asset.fractionable)
    throw refuse(`asset ${o.symbol} is not fractionable`);
  const qty = amount ? o.notional! / c.price : o.qty!;
  if (o.side === 'sell') {
    if (qty > c.available + 1e-9)
      throw refuse(
        `insufficient qty available for order (requested: ${qty}, available: ${c.available})`,
      );
    return 0;
  }
  const cost = cents(amount ? o.notional! : qty * c.price);
  if (cost > c.buyingPower + 0.005)
    throw refuse(
      `insufficient buying power (needed: ${cost}, available: ${cents(c.buyingPower)})`,
    );
  return cost;
}

/** The shares an order fills at `price` (an amount becomes shares at that price). */
export function fillQty(
  o: { qty?: number; notional?: number; side: 'buy' | 'sell' },
  price: number,
  held: number,
): number {
  const qty = o.notional !== undefined ? shares(o.notional / price) : o.qty!;
  // Selling "everything" by amount: no dust left behind.
  return o.side === 'sell' ? Math.min(qty, held) : qty;
}

/** The positions after a fill, and the cash it moves (+ for a sale). */
export function applyFill(
  positions: SimPosition[],
  fill: { symbol: string; side: 'buy' | 'sell'; qty: number; price: number },
): { positions: SimPosition[]; cash: number } {
  const value = cents(fill.qty * fill.price);
  const others = positions.filter((p) => p.symbol !== fill.symbol);
  const had = positions.find((p) => p.symbol === fill.symbol);
  if (fill.side === 'buy') {
    const qty = shares((had?.qty ?? 0) + fill.qty);
    const costBasis = cents((had?.costBasis ?? 0) + value);
    return {
      positions: [...others, { symbol: fill.symbol, qty, costBasis }],
      cash: -value,
    };
  }
  const left = shares((had?.qty ?? 0) - fill.qty);
  // The cost of what's left keeps its average price.
  const kept =
    left > 0 && had
      ? [
          ...others,
          {
            symbol: fill.symbol,
            qty: left,
            costBasis: cents((had.costBasis * left) / had.qty),
          },
        ]
      : others;
  return { positions: kept, cash: value };
}

/** A split: more (or fewer) shares, the same total cost. */
export function applySplit(
  positions: SimPosition[],
  symbol: string,
  oldRate: number,
  newRate: number,
): SimPosition[] {
  return positions.map((p) =>
    p.symbol === symbol
      ? { ...p, qty: shares((p.qty * newRate) / oldRate) }
      : p,
  );
}
