import { makeBars } from '../../test/support/bars.js';
import { SimulatedBroker } from './simulated-broker.js';

const [, day2, day3] = makeBars('AAPL', [
  [100, 101],
  [102, 104],
  [110, 108],
]);

function broker(overrides = {}) {
  return new SimulatedBroker({
    initialCash: 10_000,
    slippageBps: 0,
    feePerShare: 0,
    ...overrides,
  });
}

describe('SimulatedBroker', () => {
  it('fills a buy at the next bar open, not immediately', () => {
    const b = broker();
    b.buy('AAPL', 10);
    expect(b.fills).toEqual([]);
    expect(b.cash()).toBe(10_000);

    b.setTime(day2.timestamp);
    const [fill] = b.fillPending(day2);

    expect(fill).toMatchObject({ side: 'buy', qty: 10, price: 102 });
    expect(fill.timestamp).toEqual(day2.timestamp);
    expect(b.cash()).toBe(10_000 - 1_020);
    expect(b.position('AAPL')).toEqual({
      symbol: 'AAPL',
      qty: 10,
      avgPrice: 102,
    });
  });

  it('applies slippage against us and includes fees in the cost basis', () => {
    const b = broker({ slippageBps: 100, feePerShare: 0.5 }); // 1% slippage
    b.buy('AAPL', 10);
    const [buy] = b.fillPending(day2);
    expect(buy.price).toBeCloseTo(103.02); // 102 + 1%
    expect(b.position('AAPL')?.avgPrice).toBeCloseTo(103.52); // + 0.5 fee/share

    b.sell('AAPL', 10);
    const [sell] = b.fillPending(day3);
    expect(sell.price).toBeCloseTo(108.9); // 110 - 1%
    // 10 * (108.9 - 103.52) - 5 fee
    expect(sell.realizedPnl).toBeCloseTo(48.8);
    expect(b.position('AAPL')).toBeUndefined();
    expect(b.cash()).toBeCloseTo(10_000 + 48.8);
  });

  it('reduces a buy that no longer fits the cash to what fits', () => {
    const b = broker({ initialCash: 500 });
    b.buy('AAPL', 10, 'signal');
    const [fill] = b.fillPending(day2); // opens at 102: 10 shares cost 1,020

    expect(fill).toMatchObject({
      qty: 4,
      requestedQty: 10,
      price: 102,
      reason: 'signal (reduced from 10 to fit cash)',
    });
    expect(b.cash()).toBe(500 - 408);
    expect(b.position('AAPL')?.qty).toBe(4);
    expect(b.rejections).toEqual([]);
  });

  it('counts fees when fitting a buy to the cash', () => {
    const b = broker({ initialCash: 500, feePerShare: 1 });
    b.buy('AAPL', 10);
    const [fill] = b.fillPending(day2); // 103 per share incl. fee
    expect(fill.qty).toBe(4);
    expect(b.cash()).toBe(500 - 4 * 103);
  });

  it('rejects a buy when not even one share fits', () => {
    const b = broker({ initialCash: 50 });
    b.buy('AAPL', 10);
    expect(b.fillPending(day2)).toEqual([]);
    expect(b.rejections[0]).toMatchObject({ error: 'insufficient cash' });
    expect(b.cash()).toBe(50);
  });

  it('rejects selling more than held (no shorting)', () => {
    const b = broker();
    b.sell('AAPL', 1);
    b.fillPending(day2);
    expect(b.rejections[0].error).toMatch(/no shorting/);
  });

  it('rejects non-positive quantities immediately', () => {
    const b = broker();
    b.buy('AAPL', 0);
    b.sell('AAPL', Number.NaN);
    expect(b.rejections).toHaveLength(2);
    expect(b.pendingOrders()).toHaveLength(0);
  });

  it('only fills orders for the bar symbol', () => {
    const b = broker();
    b.buy('MSFT', 1);
    expect(b.fillPending(day2)).toEqual([]);
    expect(b.pendingOrders()).toHaveLength(1);
  });

  it('values open positions at the last close', () => {
    const b = broker();
    b.buy('AAPL', 10);
    b.fillPending(day2);
    b.markPrice(day2); // close 104
    expect(b.equity()).toBe(10_000 - 1_020 + 1_040);
  });
});
