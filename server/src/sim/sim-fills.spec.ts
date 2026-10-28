import { applyFill, applySplit, checkOrder, fillQty } from './sim-fills.js';

const market = {
  symbol: 'AAPL',
  side: 'buy' as const,
  type: 'market',
  timeInForce: 'day',
};
const ctx = {
  asset: { tradable: true, fractionable: true },
  price: 200,
  buyingPower: 1000,
  available: 3,
};

describe('checkOrder', () => {
  it('holds the cost of a buy, by shares or by amount', () => {
    expect(checkOrder({ ...market, qty: 2 }, ctx)).toBe(400);
    expect(checkOrder({ ...market, notional: 250 }, ctx)).toBe(250);
    expect(checkOrder({ ...market, side: 'sell', qty: 3 }, ctx)).toBe(0);
  });

  it('refuses what Alpaca refuses, in words the app recognizes', () => {
    expect(() => checkOrder({ ...market, qty: 6 }, ctx)).toThrow(
      /insufficient buying power/,
    );
    expect(() => checkOrder({ ...market, side: 'sell', qty: 4 }, ctx)).toThrow(
      /insufficient qty/,
    );
    const whole = { ...ctx, asset: { tradable: true, fractionable: false } };
    expect(() => checkOrder({ ...market, notional: 100 }, whole)).toThrow(
      /not fractionable/,
    );
    expect(() => checkOrder({ ...market, qty: 1.5 }, whole)).toThrow(
      /not fractionable/,
    );
    expect(checkOrder({ ...market, qty: 1 }, whole)).toBe(200);
    expect(() =>
      checkOrder({ ...market, qty: 1 }, { ...ctx, asset: null }),
    ).toThrow(/not tradable/);
    expect(() => checkOrder({ ...market, type: 'limit', qty: 1 }, ctx)).toThrow(
      /market orders only/,
    );
    try {
      checkOrder({ ...market, qty: 6 }, ctx);
    } catch (err) {
      expect(err).toMatchObject({ name: 'ValidationError', status: 403 });
    }
  });
});

describe('fills', () => {
  it('buys at the price, averaging the cost', () => {
    const one = applyFill([], {
      symbol: 'AAPL',
      side: 'buy',
      qty: 2,
      price: 100,
    });
    expect(one).toEqual({
      positions: [{ symbol: 'AAPL', qty: 2, costBasis: 200 }],
      cash: -200,
    });
    const two = applyFill(one.positions, {
      symbol: 'AAPL',
      side: 'buy',
      qty: 2,
      price: 200,
    });
    expect(two.positions).toEqual([{ symbol: 'AAPL', qty: 4, costBasis: 600 }]);
  });

  it('sells part (keeping the average price) or all', () => {
    const held = [{ symbol: 'AAPL', qty: 4, costBasis: 600 }];
    const part = applyFill(held, {
      symbol: 'AAPL',
      side: 'sell',
      qty: 1,
      price: 300,
    });
    expect(part).toEqual({
      positions: [{ symbol: 'AAPL', qty: 3, costBasis: 450 }],
      cash: 300,
    });
    expect(
      applyFill(held, { symbol: 'AAPL', side: 'sell', qty: 4, price: 300 })
        .positions,
    ).toEqual([]);
  });

  it('turns an amount into shares, and never sells more than held', () => {
    expect(fillQty({ side: 'buy', notional: 100 }, 300, 0)).toBeCloseTo(
      0.333333333,
      9,
    );
    expect(fillQty({ side: 'sell', notional: 1000 }, 300, 2)).toBe(2);
  });

  it('splits: more shares, the same cost', () => {
    expect(
      applySplit([{ symbol: 'NVDA', qty: 3, costBasis: 900 }], 'NVDA', 1, 10),
    ).toEqual([{ symbol: 'NVDA', qty: 30, costBasis: 900 }]);
  });
});
