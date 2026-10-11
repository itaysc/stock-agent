import type { TaxKind } from './activity-map.js';
import { yearReport, type ReportRecord } from './tax-report.js';

let n = 0;
const rec = (
  kind: TaxKind,
  day: string,
  extra: Partial<ReportRecord> = {},
): ReportRecord => {
  const usdIls = extra.usdIls ?? 3.5;
  const amountUsd = extra.amountUsd ?? (extra.qty ?? 0) * (extra.priceUsd ?? 0);
  return {
    activityId: `r${n++}`,
    kind,
    at: new Date(`${day}T15:00:00Z`),
    day,
    amountUsd,
    usdIls,
    amountIls: amountUsd * usdIls,
    ...extra,
  };
};
const buy = (day: string, qty: number, priceUsd: number) =>
  rec('buy', day, { symbol: 'CAT', qty, priceUsd });
const sell = (day: string, qty: number, priceUsd: number) =>
  rec('sell', day, { symbol: 'CAT', qty, priceUsd });

describe('yearReport', () => {
  it('carries a loss into the next year and estimates the tax on the rest', () => {
    const records = [
      buy('2026-02-01', 10, 100),
      sell('2026-06-01', 10, 80), // -$200
      buy('2027-02-01', 10, 100),
      sell('2027-06-01', 10, 150), // +$500
    ];
    const y2026 = yearReport(records, 2026, false);
    expect(y2026.totals.realNetIls).toBeCloseTo(-700);
    expect(y2026.carriedOutIls).toBeCloseTo(700);
    expect(y2026.estimatedTaxIls).toBe(0);
    expect(y2026.notes.join(' ')).toMatch(/carry forward/);

    const y2027 = yearReport(records, 2027, false);
    expect(y2027.carriedInIls).toBeCloseTo(700);
    expect(y2027.estimatedTaxIls).toBeCloseTo((1750 - 700) * 0.25);
    expect(y2027.carriedOutIls).toBe(0);
  });

  it('counts dividends, the US tax withheld and fees', () => {
    const r = yearReport(
      [
        rec('dividend', '2026-05-01', { amountUsd: 10 }),
        rec('tax_withheld', '2026-05-01', { amountUsd: -2.5 }),
        rec('fee', '2026-05-02', { amountUsd: -0.02 }),
      ],
      2026,
      false,
    );
    expect(r.income).toMatchObject({ dividendsIls: 35, withheldIls: 8.75 });
    expect(r.income.feesIls).toBeCloseTo(0.07);
    expect(r.estimatedTaxIls).toBe(0); // 25% of the dividend, already withheld in the US
  });

  it('marks paper trades as nothing to report', () => {
    const r = yearReport([buy('2026-02-01', 1, 10)], 2026, true);
    expect(r.notes[0]).toMatch(/paper/);
    expect(r.openAtYearEnd).toHaveLength(1);
  });
});
