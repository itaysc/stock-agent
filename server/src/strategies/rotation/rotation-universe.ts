/**
 * Lab only: which symbols the rotation may hold at a date, e.g. "the 50
 * biggest S&P 500 members of that year" (a point-in-time universe, so a
 * backtest can't pick today's winners in hindsight). Unset (the default, and
 * always for the live broker): every symbol.
 */
let allowedFn: ((symbol: string, at: Date) => boolean) | null = null;

export const pointInTime = {
  set(fn: ((symbol: string, at: Date) => boolean) | null): void {
    allowedFn = fn;
  },
  allowed(symbol: string, at: Date): boolean {
    return !allowedFn || allowedFn(symbol, at);
  },
};
