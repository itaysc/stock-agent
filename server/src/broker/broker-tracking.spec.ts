import { matchTrades } from './broker-tracking.js';

const t = (symbol: string, side: 'buy' | 'sell', date = '2026-10-05') => ({
  symbol,
  side,
  date,
  price: 100,
});

describe('matchTrades', () => {
  it('pairs trades by stock and side, and lists what only one of them did', () => {
    const r = matchTrades(
      [t('AAA', 'buy'), t('BBB', 'buy'), t('AAA', 'sell', '2026-10-09')],
      [t('AAA', 'buy'), t('CCC', 'buy'), t('AAA', 'sell', '2026-10-12')],
    );
    expect(r.both.map((x) => `${x.side} ${x.symbol}`)).toEqual([
      'buy AAA',
      'sell AAA',
    ]);
    expect(r.liveOnly.map((x) => x.symbol)).toEqual(['BBB']);
    expect(r.testOnly.map((x) => x.symbol)).toEqual(['CCC']);
  });
});
