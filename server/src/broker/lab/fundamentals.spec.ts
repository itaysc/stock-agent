import { fundamentalsFrom } from './fundamentals.js';
import type { Facts } from './sec-facts.js';

const year = (end: string, val: number, filed: string) => ({
  start: `${Number(end.slice(0, 4)) - 1}${end.slice(4)}`,
  end,
  val,
  filed,
});
const facts: Record<string, Facts> = {
  ABC: {
    NetIncomeLoss: [
      year('2019-12-31', 10, '2020-02-15'),
      year('2020-12-31', 20, '2021-02-15'),
    ],
    Assets: [{ end: '2020-12-31', val: 200, filed: '2021-02-15' }],
    StockholdersEquity: [{ end: '2020-12-31', val: 100, filed: '2021-02-15' }],
    EntityPublicFloat: [{ end: '2020-06-30', val: 1000, filed: '2021-02-15' }],
  },
};
// The price doubled since the float was measured.
const price = (_: string, at: string) => (at < '2020-07-01' ? 10 : 20);

describe('fundamentalsFrom', () => {
  const f = fundamentalsFrom(facts, price);

  it('only uses reports filed by that day', () => {
    expect(f('ABC', new Date('2021-01-10'))?.ep).toBeNull(); // no float filed yet
    expect(f('ABC', new Date('2021-03-01'))).toEqual({
      ep: 20 / 2000, // market value: the float moved by the price since (×2)
      bm: 100 / 2000,
      gpa: null,
      roa: 20 / 200,
      turnover: null, // no volumes given
    });
  });

  it('ignores figures the company stopped reporting long ago', () => {
    expect(f('ABC', new Date('2024-06-01'))?.roa).toBeNull();
  });

  it('is null for a company without reports', () => {
    expect(f('XYZ', new Date('2021-03-01'))).toBeNull();
  });
});
