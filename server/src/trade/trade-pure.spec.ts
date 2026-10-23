import { levelHit } from '../paper/manual-exits.js';
import { type Asset, searchAssets } from './assets.service.js';
import { buySize, plainOrderError, sellQty } from './trade-sizing.js';
import { rankTrending } from './trending.js';
import { paidInShekels } from './paid.js';

describe('buySize', () => {
  it('sends a dollar amount for a fractional stock, whole shares otherwise', () => {
    expect(buySize(250.567, 100, true)).toEqual({ notional: 250.56 });
    expect(buySize(250, 100, false)).toEqual({ qty: 2 });
  });
  it('says why nothing fits', () => {
    expect(() => buySize(50, 100, false)).toThrow(/whole shares.*\$100/);
    expect(() => buySize(0.5, 100, true)).toThrow(/at least \$1/);
  });
});

describe('sellQty', () => {
  it('sells all of yours, or about the amount, never more than you hold', () => {
    expect(sellQty(2.5, 100, true)).toBe(2.5);
    expect(sellQty(2.5, 100, true, 120)).toBe(1.2);
    expect(sellQty(2.5, 100, true, 9999)).toBe(2.5);
    expect(sellQty(5, 100, false, 250)).toBe(2);
  });
  it('refuses when you hold none', () => {
    expect(() => sellQty(0, 100, true)).toThrow(/don't hold/);
  });
});

it('puts broker refusals in plain words', () => {
  expect(plainOrderError(new Error('potential wash trade detected'))).toMatch(
    /opposite order open/,
  );
});

describe('searchAssets', () => {
  const a = (symbol: string, name: string): Asset => ({
    symbol,
    name,
    exchange: 'NASDAQ',
    tradable: true,
    fractionable: true,
  });
  const all = [
    a('AAPL', 'Apple Inc. Common Stock'),
    a('AAP', 'Advance Auto Parts'),
    a('APLE', 'Apple Hospitality REIT'),
    a('NVDA', 'NVIDIA Corporation'),
  ];
  it('ranks the exact ticker, then ticker starts, then names', () => {
    expect(searchAssets(all, 'aap').map((x) => x.symbol)).toEqual([
      'AAP',
      'AAPL',
    ]);
    expect(searchAssets(all, 'apple').map((x) => x.symbol)).toEqual([
      'AAPL',
      'APLE',
    ]);
    expect(searchAssets(all, 'nvidia corp')[0].symbol).toBe('NVDA');
    expect(searchAssets(all, '  ')).toEqual([]);
  });
});

describe('rankTrending', () => {
  const series = (start: number, step: number, n = 300) =>
    Array.from({ length: n }, (_, i) => ({
      timestamp: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000),
      close: start * (1 + step) ** i,
    }));
  it('puts rising trends first, each by 12-1 month momentum', () => {
    const r = rankTrending({
      SLOW: series(100, 0.0005),
      FAST: series(100, 0.002),
      DOWN: series(100, -0.001),
      NEW: series(100, 0.01, 100), // too little history
    });
    expect(r.map((x) => x.symbol)).toEqual(['FAST', 'SLOW', 'DOWN']);
    expect(r[0].aboveTrend).toBe(true);
    expect(r[2].aboveTrend).toBe(false);
    expect(r[0].spark).toHaveLength(63);
  });
});

it('levelHit: a close at or past your stop or target', () => {
  expect(levelHit({ stopPrice: 90 }, 89)).toMatch(/stop loss/);
  expect(levelHit({ takeProfitPrice: 120 }, 121)).toMatch(/profit target/);
  expect(levelHit({ stopPrice: 90, takeProfitPrice: 120 }, 100)).toBeNull();
  expect(levelHit(undefined, 100)).toBeNull();
});

it('paidInShekels: each buy at its own day rate, scaled to the shares still held', () => {
  const rate: Record<string, number> = { '2026-10-01': 3.5, '2026-10-02': 4 };
  const buys = [
    { qty: 1, price: 100, timestamp: '2026-10-01T15:00:00Z' },
    { qty: 1, price: 100, timestamp: '2026-10-02T15:00:00Z' },
  ];
  expect(paidInShekels(buys, 2, (d) => rate[d])).toBeCloseTo(750);
  expect(paidInShekels(buys, 1, (d) => rate[d])).toBeCloseTo(375);
  expect(paidInShekels(buys, 2, () => undefined)).toBeNull();
});
