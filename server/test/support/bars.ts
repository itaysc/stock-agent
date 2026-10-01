import type { StrategyBar } from '../../src/strategies/strategy.types.js';

/**
 * Builds one daily bar per price, starting at `start`. A price is either a
 * close (open = previous close) or an explicit [open, close] pair.
 */
export function makeBars(
  symbol: string,
  prices: Array<number | [number, number]>,
  start = '2025-01-01',
): StrategyBar[] {
  const t0 = new Date(`${start}T00:00:00Z`).getTime();
  let previousClose: number | undefined;
  return prices.map((price, i) => {
    const [open, close] = Array.isArray(price)
      ? price
      : [previousClose ?? price, price];
    previousClose = close;
    return {
      symbol,
      timestamp: new Date(t0 + i * 86_400_000),
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      volume: 1_000,
    };
  });
}
