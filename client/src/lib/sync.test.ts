import { syncSummary } from './sync';

describe('syncSummary', () => {
  it('says what changed, or that nothing did', () => {
    expect(
      syncSummary({
        added: [{ symbol: 'MSFT', side: 'buy', qty: 3, price: 400 }],
        removed: [{ symbol: 'AAPL', side: 'sell', qty: 0.5, price: 200 }],
        orders: 1,
        skipped: ['NVDA'],
      }),
    ).toBe(
      'Synced with Alpaca: added 3 MSFT (bought outside the app); lowered 0.5000 AAPL (sold outside the app); following 1 open order placed outside the app; NVDA waits for its order to finish.',
    );
    expect(syncSummary({ added: [], removed: [], orders: 0, skipped: [] })).toMatch(
      /Already in sync/,
    );
  });
});
