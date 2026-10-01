import { emptyLedger, bookFill } from '../paper/sleeve-ledger.js';
import { cleanQty, roundQty } from './qty.js';

describe('share amounts', () => {
  it('rounds down to whole shares or 4 decimals, without float noise', () => {
    expect(roundQty(2.9, false)).toBe(2);
    expect(roundQty(0.123456, true)).toBe(0.1234);
    expect(roundQty(0.3, true)).toBe(0.3);
    expect(cleanQty(0.1 + 0.2)).toBe(0.3);
  });

  it('closes a fractional position fully (no dust left)', () => {
    const l = emptyLedger(100);
    const fill = { timestamp: new Date(), symbol: 'COST', price: 100 };
    bookFill(l, { ...fill, side: 'buy', qty: 0.1 });
    bookFill(l, { ...fill, side: 'buy', qty: 0.2 });
    expect(l.positions.COST.qty).toBe(0.3);
    bookFill(l, { ...fill, side: 'sell', qty: 0.3 });
    expect(l.positions.COST).toBeUndefined();
  });
});

describe('fractional amounts in the simulator', () => {
  it('sells a position built from float-noisy pieces in full', async () => {
    const { SimulatedBroker } = await import('../backtest/simulated-broker.js');
    const b = new SimulatedBroker({
      initialCash: 1_000,
      slippageBps: 0,
      feePerShare: 0,
    });
    const bar = (t: number) => ({
      symbol: 'X',
      timestamp: new Date(t),
      open: 10,
      high: 10,
      low: 10,
      close: 10,
      volume: 1,
    });
    b.setTime?.(new Date(1));
    b.buy('X', 0.1);
    b.fillPending(bar(1));
    b.buy('X', 0.2);
    b.fillPending(bar(2));
    b.sell('X', 0.30000001);
    expect(b.fillPending(bar(3))).toHaveLength(1);
    expect(b.openPositions()).toEqual([]);
  });
});
