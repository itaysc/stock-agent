/** Fractional shares are kept to this many decimals (Alpaca allows fractional market day orders). */
export const QTY_DECIMALS = 4;

/** A share amount to order: whole shares, or fractional ones (rounded down to 4 decimals). */
export function roundQty(qty: number, fractional: boolean): number {
  if (!fractional) return Math.floor(qty + 1e-9);
  const f = 10 ** QTY_DECIMALS;
  return Math.floor(qty * f + 1e-6) / f;
}

/** Removes float noise from share sums (0.30000000000000004 → 0.3). */
export const cleanQty = (qty: number) => Math.round(qty * 1e8) / 1e8;
