import { boughtSince, syncChanges } from './alpaca-sync.js';

const holding = (symbol: string, qty: number, avgPrice = 100, price = 110) => ({
  symbol,
  qty,
  avgPrice,
  price,
});

describe('syncChanges', () => {
  it('adds what you bought outside the app, net of the investments', () => {
    const r = syncChanges({
      account: [holding('AAPL', 10, 150), holding('MSFT', 4)],
      investments: { MSFT: 4 },
      mine: {},
      busy: new Set(),
    });
    expect(r.changes).toEqual([
      { symbol: 'AAPL', side: 'buy', qty: 10, price: 150 },
    ]);
  });

  it('lowers what you sold outside the app, at the latest price', () => {
    const r = syncChanges({
      account: [holding('AAPL', 4, 150, 160)],
      investments: {},
      mine: {
        AAPL: { qty: 10, avgPrice: 150 },
        NVDA: { qty: 2, avgPrice: 90 },
      },
      busy: new Set(),
    });
    expect(r.changes).toEqual([
      { symbol: 'AAPL', side: 'sell', qty: 6, price: 160 },
      { symbol: 'NVDA', side: 'sell', qty: 2, price: 90 },
    ]);
  });

  it('leaves stocks with an order on the way, and what already matches', () => {
    const r = syncChanges({
      account: [holding('AAPL', 10), holding('XOM', 3)],
      investments: { XOM: 5 }, // claims more than the account holds: not yours to fix
      mine: { AAPL: { qty: 2, avgPrice: 100 } },
      busy: new Set(['AAPL']),
    });
    expect(r).toEqual({ changes: [], skipped: ['AAPL'] });
  });
});

describe('boughtSince', () => {
  const at = (d: string) => new Date(`2026-${d}T15:00:00Z`);
  it('goes back through the buys until they cover the shares', () => {
    const buys = [
      { qty: 5, at: at('03-01') },
      { qty: 3, at: at('05-01') },
      { qty: 2, at: at('06-01') },
    ];
    expect(boughtSince(buys, 4)).toEqual(at('05-01'));
    expect(boughtSince(buys, 2)).toEqual(at('06-01'));
    expect(boughtSince(buys, 50)).toEqual(at('03-01'));
    expect(boughtSince([], 1)).toBeNull();
  });
});
