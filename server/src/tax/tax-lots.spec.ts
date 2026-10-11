import { mapActivity } from './activity-map.js';
import { parseBoiCsv, rateFor } from './boi-rates.js';
import { matchLots, type TradeRecord } from './tax-lots.js';

const trade = (
  kind: 'buy' | 'sell',
  day: string,
  qty: number,
  priceUsd: number,
  usdIls: number,
  symbol = 'AMD',
): TradeRecord => ({
  activityId: `${day}-${kind}-${qty}`,
  kind,
  at: new Date(`${day}T15:00:00Z`),
  day,
  symbol,
  qty,
  priceUsd,
  usdIls,
});

describe('matchLots (first in, first out)', () => {
  it('sells the earliest shares first, each at its own buy-day rate', () => {
    const { sales, open } = matchLots([
      trade('buy', '2026-01-05', 1, 100, 3.5),
      trade('buy', '2026-02-05', 1, 120, 3.6),
      trade('sell', '2026-03-05', 1.5, 130, 3.4),
    ]);
    expect(sales).toHaveLength(1);
    const s = sales[0];
    expect(s.costUsd).toBeCloseTo(100 + 0.5 * 120);
    expect(s.costIls).toBeCloseTo(100 * 3.5 + 60 * 3.6);
    expect(s.proceedsIls).toBeCloseTo(195 * 3.4);
    expect(s.gainUsd).toBeCloseTo(35);
    expect(s.realGainIls).toBeCloseTo(35 * 3.4);
    expect(s.gainIls).toBeCloseTo(195 * 3.4 - (350 + 216));
    expect(s.boughtOn).toEqual(['2026-01-05', '2026-02-05']);
    expect(open).toEqual([
      expect.objectContaining({ boughtOn: '2026-02-05', qty: 0.5 }),
    ]);
  });

  it('flags shares sold without a recorded buy', () => {
    const { sales } = matchLots([trade('sell', '2026-03-05', 2, 50, 3.4)]);
    expect(sales[0]).toMatchObject({ unmatchedQty: 2, gainUsd: 0 });
  });
});

describe('Bank of Israel rates', () => {
  const csv = `SERIES_CODE,FREQ,TIME_PERIOD,OBS_VALUE
RER_USD_ILS,D,2026-10-08,3.084
RER_USD_ILS,D,2026-10-09,3.055`;

  it('reads the CSV and uses the last rate on or before a day', () => {
    const rates = parseBoiCsv(csv);
    expect(rates).toEqual([
      { date: '2026-10-08', rate: 3.084 },
      { date: '2026-10-09', rate: 3.055 },
    ]);
    expect(rateFor(rates, '2026-10-11')?.rate).toBe(3.055); // a Sunday: Friday's rate
    expect(rateFor(rates, '2026-10-07')).toBeNull();
  });
});

describe('mapActivity', () => {
  it('reads a fill on its New York day', () => {
    expect(
      mapActivity({
        id: 'a1',
        activity_type: 'FILL',
        transaction_time: '2026-10-02T13:30:00.68Z',
        side: 'buy',
        symbol: 'AMD',
        qty: '0.0403',
        price: '636.37',
      }),
    ).toMatchObject({ kind: 'buy', day: '2026-10-02', qty: 0.0403 });
  });

  it('reads a dividend withholding and a fee as signed cash', () => {
    expect(
      mapActivity({
        id: 'a2',
        activity_type: 'DIVNRA',
        date: '2026-11-14',
        net_amount: '-1.25',
      }),
    ).toMatchObject({
      kind: 'tax_withheld',
      day: '2026-11-14',
      amountUsd: -1.25,
    });
    expect(
      mapActivity({
        id: 'a3',
        activity_type: 'FEE',
        date: '2026-10-07',
        net_amount: '-0.01',
      }),
    ).toMatchObject({ kind: 'fee', amountUsd: -0.01 });
  });
});
