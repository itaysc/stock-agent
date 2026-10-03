import { fitBuys, OPEN_GAP } from './fit-buys.js';
import { emptyLedger } from './sleeve-ledger.js';

const ledger = (cash: number) => ({
  ...emptyLedger(cash),
  lastPrices: { AAA: 100, BBB: 50, CCC: 10 },
});
const buy = (symbol: string, qty: number) => ({
  symbol,
  side: 'buy' as const,
  qty,
});

describe('fitBuys', () => {
  it('leaves buys that fit the cash (with room for a higher open)', () => {
    const orders = [buy('AAA', 1), buy('BBB', 1)];
    expect(fitBuys(ledger(200), orders)).toEqual(orders);
  });

  it('shrinks every buy by the same share when they cost more than the cash', () => {
    const out = fitBuys(ledger(150), [buy('AAA', 1.2), buy('BBB', 1.2)]);
    expect(out.map((o) => o.qty)).toEqual([1, 1]); // 150 of 180: each × 5/6
  });

  it('keeps room for a higher open on whole shares only (fractional buys go out as dollar amounts)', () => {
    expect(fitBuys(ledger(150), [buy('AAA', 1.5)])[0].qty).toBe(1.5);
    const whole = fitBuys(ledger(150), [buy('BBB', 3)]);
    expect(whole[0].qty * 50 * (1 + OPEN_GAP)).toBeLessThanOrEqual(150);
  });

  it("counts this batch's sells, and buys already on the way", () => {
    const l = ledger(0);
    const withSell = fitBuys(l, [
      { symbol: 'CCC', side: 'sell', qty: 10 },
      buy('BBB', 1.9),
    ]);
    expect(withSell.find((o) => o.side === 'buy')?.qty).toBeCloseTo(1.9);
    l.cash = 100;
    l.pending.push({
      clientOrderId: 'x',
      symbol: 'AAA',
      side: 'buy',
      qty: 1,
      submittedAt: new Date(),
      bookedQty: 0,
    });
    expect(fitBuys(l, [buy('BBB', 1)])).toEqual([]);
  });

  it('keeps whole-share orders whole', () => {
    const out = fitBuys(ledger(250), [buy('AAA', 3)]);
    expect(out[0].qty).toBe(2);
  });
});
