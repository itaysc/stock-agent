import { TaxLedger } from './tax-ledger.js';

const at = (iso: string) => new Date(iso);

describe('TaxLedger (yearly capital gains tax)', () => {
  it('taxes a year’s net gain when the next year starts', () => {
    const t = new TaxLedger(0.25);
    t.record(1000, at('2020-03-01'));
    t.record(-400, at('2020-09-01'));
    expect(t.roll(at('2020-12-31'))).toBe(0);
    expect(t.roll(at('2021-01-04'))).toBe(150); // 25% of 600
    expect(t.paid()).toBe(150);
  });

  it('carries a net loss forward to later gains', () => {
    const t = new TaxLedger(0.25);
    t.record(-1000, at('2020-05-01'));
    expect(t.roll(at('2021-01-04'))).toBe(0);
    t.record(1500, at('2021-06-01'));
    expect(t.roll(at('2022-01-03'))).toBe(125); // (1500 - 1000) × 25%
  });

  it('ifSoldNow adds open gains to this year’s and nets the carried losses', () => {
    const t = new TaxLedger(0.25);
    t.record(-200, at('2020-05-01'));
    t.roll(at('2021-01-04'));
    t.record(100, at('2021-02-01'));
    expect(t.ifSoldNow(500)).toBe(100); // (100 + 500 - 200) × 25%
    expect(t.ifSoldNow(0)).toBe(0);
  });
});
