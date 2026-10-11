import type { TaxKind } from './activity-map.js';
import {
  matchLots,
  type OpenLot,
  type Sale,
  type TradeRecord,
} from './tax-lots.js';

/** A stored activity, as the report needs it. */
export interface ReportRecord {
  activityId: string;
  kind: TaxKind;
  at: Date;
  day: string;
  symbol?: string;
  qty?: number;
  priceUsd?: number;
  amountUsd: number;
  usdIls: number;
  amountIls: number;
}

/** Israel's rate on capital gains and dividends for an individual (general case). */
export const TAX_RATE = 0.25;

export interface YearReport {
  year: number;
  paper: boolean;
  sales: Sale[];
  totals: {
    proceedsIls: number;
    costIls: number;
    /** Sum of the sales with a gain / with a loss (negative), on the dollar method. */
    gainsIls: number;
    lossesIls: number;
    /** Net of all sales: shekels in minus out, and on the dollar method. */
    netIls: number;
    realNetIls: number;
  };
  income: {
    dividendsIls: number;
    /** Tax already withheld abroad (positive). */
    withheldIls: number;
    interestIls: number;
    /** Broker fees (positive): an expense against the gains. */
    feesIls: number;
  };
  /** Capital losses carried in from earlier years, used this year, and carried to next year. */
  carriedInIls: number;
  carriedOutIls: number;
  /** A rough estimate: 25% of the net gain after fees and carried losses, plus dividend tax beyond what was withheld. */
  estimatedTaxIls: number;
  /** Shares held at the end of the year (cost basis). */
  openAtYearEnd: OpenLot[];
  notes: string[];
}

const yearOf = (day: string) => Number(day.slice(0, 4));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const trades = (records: ReportRecord[], until: number): TradeRecord[] =>
  records.flatMap((r) =>
    (r.kind === 'buy' || r.kind === 'sell') &&
    r.symbol &&
    r.qty &&
    r.priceUsd &&
    yearOf(r.day) <= until
      ? [
          {
            activityId: r.activityId,
            kind: r.kind,
            at: r.at,
            day: r.day,
            symbol: r.symbol,
            qty: r.qty,
            priceUsd: r.priceUsd,
            usdIls: r.usdIls,
          },
        ]
      : [],
  );

/** One year's net capital result (dollar method, after fees). */
function yearNet(records: ReportRecord[], sales: Sale[], year: number) {
  const fees = -sum(
    records
      .filter((r) => r.kind === 'fee' && yearOf(r.day) === year)
      .map((r) => r.amountIls),
  );
  return (
    sum(
      sales.filter((s) => yearOf(s.soldOn) === year).map((s) => s.realGainIls),
    ) - fees
  );
}

/**
 * The year's tax picture from the stored records (all years of one account
 * kind, paper or real): each sale matched to its buys, totals in shekels,
 * dividends and withholding, losses carried between years, and an estimate.
 * General information for the yearly report, not tax advice.
 */
export function yearReport(
  records: ReportRecord[],
  year: number,
  paper: boolean,
): YearReport {
  const { sales: all, open } = matchLots(trades(records, year));
  const sales = all.filter((s) => yearOf(s.soldOn) === year);
  const inYear = (k: TaxKind) =>
    records.filter((r) => r.kind === k && yearOf(r.day) === year);
  const ils = (k: TaxKind) => sum(inYear(k).map((r) => r.amountIls));
  const first = Math.min(...records.map((r) => yearOf(r.day)), year);
  let carried = 0;
  for (let y = first; y < year; y++) {
    const net = yearNet(records, all, y);
    carried = net < 0 ? carried - net : Math.max(0, carried - net);
  }
  const net = yearNet(records, all, year);
  const carriedOut = net < 0 ? carried - net : Math.max(0, carried - net);
  const taxable = Math.max(0, net - carried);
  const dividendsIls = ils('dividend');
  const withheldIls = -ils('tax_withheld');
  const real = sales.map((s) => s.realGainIls);
  const report: YearReport = {
    year,
    paper,
    sales,
    totals: {
      proceedsIls: sum(sales.map((s) => s.proceedsIls)),
      costIls: sum(sales.map((s) => s.costIls)),
      gainsIls: sum(real.filter((g) => g > 0)),
      lossesIls: sum(real.filter((g) => g < 0)),
      netIls: sum(sales.map((s) => s.gainIls)),
      realNetIls: sum(real),
    },
    income: {
      dividendsIls,
      withheldIls,
      interestIls: ils('interest'),
      feesIls: -ils('fee'),
    },
    carriedInIls: carried,
    carriedOutIls: carriedOut,
    estimatedTaxIls:
      taxable * TAX_RATE + Math.max(0, dividendsIls * TAX_RATE - withheldIls),
    openAtYearEnd: open,
    notes: [],
  };
  report.notes = notesFor(report);
  return report;
}

function notesFor(r: YearReport): string[] {
  const n: string[] = [];
  const ils = (x: number) =>
    `₪${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
  if (r.paper)
    n.push(
      'These are paper (practice) trades with no real money: nothing to report.',
    );
  if (r.sales.some((s) => s.unmatchedQty > 0))
    n.push(
      'Some sales have no recorded buy (bought before the records start): their cost is missing, so their gain is shown as 0. Add the real cost from the broker statement.',
    );
  if (r.sales.length && !r.paper)
    n.push(
      `${r.sales.length} sales this year. A foreign broker like Alpaca withholds no Israeli tax, so Israeli residents in this situation usually file a yearly report (form 1301) with the capital gains appendix (form 1322) listing each sale.`,
    );
  if (r.totals.realNetIls - r.income.feesIls <= -1)
    n.push(
      `A net capital loss of ${ils(r.totals.realNetIls - r.income.feesIls)}: reporting it lets it carry forward against future gains.`,
    );
  if (r.carriedInIls > 0)
    n.push(`${ils(r.carriedInIls)} of losses carried in from earlier years.`);
  if (r.income.dividendsIls > 0)
    n.push(
      `Dividends ${ils(r.income.dividendsIls)}, with ${ils(r.income.withheldIls)} US tax already withheld (it counts against the Israeli tax on them).`,
    );
  const held = new Set(r.openAtYearEnd.map((l) => l.symbol)).size;
  if (held)
    n.push(
      `${held} stocks still held at the end of the year: not taxed until sold.`,
    );
  n.push(
    'Estimates only, not tax advice: confirm the method (shekel or dollar-based gain), the forms and any filing exemption with an Israeli accountant.',
  );
  return n;
}
