const cents = (n: number) => Math.floor(n * 100) / 100;

/** A market order's size: dollars (fractional shares) or whole shares. */
export type OrderSize = { notional: number } | { qty: number };

/**
 * The buy for `amount` dollars at about `price`: a dollar amount when the
 * stock trades in fractions (it fills for exactly that), otherwise the whole
 * shares that fit. Throws with a plain reason when nothing fits.
 */
export function buySize(
  amount: number,
  price: number,
  fractionable: boolean,
): OrderSize {
  if (!(amount >= 1)) throw new Error('The amount must be at least $1');
  if (fractionable) return { notional: cents(amount) };
  if (!(price > 0)) throw new Error('No current price for this stock');
  const qty = Math.floor(amount / price);
  if (qty < 1)
    throw new Error(
      `This stock is only sold in whole shares: one costs about $${price.toFixed(2)}`,
    );
  return { qty };
}

/**
 * The shares to sell: all of yours, or about `amount` dollars' worth (whole
 * shares when the stock doesn't trade in fractions), never more than you hold.
 */
export function sellQty(
  held: number,
  price: number,
  fractionable: boolean,
  amount?: number,
): number {
  if (!(held > 0))
    throw new Error("You don't hold this stock on the Trade page");
  if (amount === undefined) return held;
  if (!(price > 0)) throw new Error('No current price for this stock');
  const want = amount / price;
  const qty = fractionable ? Math.floor(want * 1e6) / 1e6 : Math.floor(want);
  if (!(qty > 0))
    throw new Error(
      fractionable
        ? 'The amount is too small'
        : `This stock is only sold in whole shares: one is about $${price.toFixed(2)}`,
    );
  return Math.min(qty, held);
}

/** Alpaca's refusals in plain words. */
export function plainOrderError(err: unknown): string {
  const m = (err as Error)?.message ?? String(err);
  if (/wash trade/i.test(m))
    return 'One of your broker investments has an opposite order open on this stock: try again after it fills (usually at the next open).';
  if (/insufficient|buying power/i.test(m))
    return 'Not enough cash in the account for this buy.';
  if (/not tradable|not active|asset.*not found/i.test(m))
    return 'This stock cannot be traded on Alpaca.';
  if (/fraction/i.test(m))
    return 'This stock cannot be traded in fractions right now: use an amount of at least one whole share.';
  return m;
}
