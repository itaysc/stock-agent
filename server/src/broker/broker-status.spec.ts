import { holdingStatus } from './broker-status.js';

const base = {
  symbol: 'NVDA',
  price: 200,
  autoStop: 150,
  autoTake: null,
  manual: undefined,
  ranks: { total: 50, rank: { NVDA: 2, XOM: 9 }, wanted: ['NVDA'] },
  selling: false,
  safe: false,
};

describe('holding status', () => {
  it('says how each holding is doing, and uses your levels when tighter', () => {
    expect(holdingStatus(base)).toMatchObject({
      label: 'Strong',
      tone: 'good',
      rank: 2,
      stopPrice: 150,
      stopIsYours: false,
    });
    expect(holdingStatus({ ...base, symbol: 'XOM' })).toMatchObject({
      label: 'Weakening',
      text: expect.stringMatching(/^Now #9 of 50/),
    });
    expect(
      holdingStatus({ ...base, manual: { stopPrice: 195 } }),
    ).toMatchObject({ label: 'Near stop', stopPrice: 195, stopIsYours: true });
    expect(
      holdingStatus({ ...base, manual: { stopPrice: 100 } }),
    ).toMatchObject({ stopPrice: 150, stopIsYours: false });
    expect(
      holdingStatus({ ...base, manual: { takeProfitPrice: 205 } }),
    ).toMatchObject({
      label: 'Near target',
      takeProfitPrice: 205,
      takeIsYours: true,
    });
    expect(holdingStatus({ ...base, selling: true }).label).toBe('Selling');
    expect(
      holdingStatus({ ...base, symbol: 'BIL', safe: true, autoStop: null })
        .label,
    ).toBe('Parked');
  });
});
