import { cutForBear, marketInBear } from './rotation-bear.js';

describe('crash guard (bearCut)', () => {
  it('is in a bear state when the market is below where it was 2 years ago', () => {
    const falling = Array.from({ length: 600 }, (_, i) => 100 - i * 0.01);
    expect(marketInBear(falling, 24)).toBe(true);
    expect(marketInBear([...falling].reverse(), 24)).toBe(false);
    expect(marketInBear(falling.slice(0, 100), 24)).toBeNull();
  });

  it('moves the cut share of the stocks to the safe asset', () => {
    const out = cutForBear(
      new Map([
        ['AAA', { weight: 0.6, why: 'top' }],
        ['BIL', { weight: 0.4, why: 'safe' }],
      ]),
      50,
      'BIL',
    );
    expect(out.get('AAA')?.weight).toBeCloseTo(0.3);
    expect(out.get('BIL')?.weight).toBeCloseTo(0.7);
  });
});
