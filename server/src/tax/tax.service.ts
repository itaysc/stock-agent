import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { parseTimeframe } from '../strategies/timeframe.js';
import { TaxRecordDoc } from './tax-record.schema.js';
import { yearReport, type ReportRecord } from './tax-report.js';
import { UsdIlsService } from './usd-ils.service.js';

const DAY_MS = 86_400_000;

/** The tax records and the yearly report built from them. */
@Injectable()
export class TaxService {
  constructor(
    private readonly alpaca: AlpacaService,
    private readonly rates: UsdIlsService,
    @InjectModel(TaxRecordDoc.name)
    private readonly records: Model<TaxRecordDoc>,
  ) {}

  /** The years with records, for paper and for real money. */
  async years(): Promise<
    Array<{ year: number; paper: boolean; count: number }>
  > {
    const rows = await this.records.aggregate<{
      _id: { year: string; paper: boolean };
      count: number;
    }>([
      {
        $group: {
          _id: { year: { $substrBytes: ['$day', 0, 4] }, paper: '$paper' },
          count: { $sum: 1 },
        },
      },
    ]);
    return rows
      .map((r) => ({
        year: Number(r._id.year),
        paper: r._id.paper,
        count: r.count,
      }))
      .sort((a, b) => b.year - a.year || Number(a.paper) - Number(b.paper));
  }

  /** One year's stored activities (oldest first). */
  list(year: number, paper: boolean) {
    return this.records
      .find({ paper, day: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } })
      .sort({ at: 1 })
      .lean();
  }

  /** The year's report, with what the holdings left at the end were worth (in dollars and shekels). */
  async report(year: number, paper: boolean) {
    const all = (await this.records
      .find({ paper, day: { $lte: `${year}-12-31` } })
      .sort({ at: 1 })
      .lean()) as unknown as ReportRecord[];
    const r = yearReport(all, year, paper);
    const end = new Date(Math.min(Date.now(), Date.UTC(year, 11, 31, 23)));
    const symbols = [...new Set(r.openAtYearEnd.map((l) => l.symbol))];
    const closes = symbols.length
      ? await this.alpaca
          .getBarsMany(symbols, {
            timeframe: parseTimeframe('1Day'),
            start: new Date(end.getTime() - 10 * DAY_MS),
            end,
          })
          .catch(() => ({}) as Record<string, Array<{ close: number }>>)
      : {};
    const day = end.toISOString().slice(0, 10);
    const rate = (await this.rates.ratesFor([day])).get(day)?.rate ?? null;
    const holdings = symbols.map((s) => {
      const lots = r.openAtYearEnd.filter((l) => l.symbol === s);
      const qty = lots.reduce((n, l) => n + l.qty, 0);
      const price = closes[s]?.at(-1)?.close ?? null;
      const valueUsd = price === null ? null : qty * price;
      return {
        symbol: s,
        qty,
        costUsd: lots.reduce((n, l) => n + l.qty * l.priceUsd, 0),
        costIls: lots.reduce((n, l) => n + l.qty * l.priceUsd * l.usdIls, 0),
        valueUsd,
        valueIls: valueUsd !== null && rate !== null ? valueUsd * rate : null,
      };
    });
    return { ...r, holdings, valuedOn: day, valueRate: rate };
  }

  /** The year's sales as CSV, one row each (the details form 1322 asks for, in shekels). */
  async salesCsv(year: number, paper: boolean): Promise<string> {
    const { sales } = await this.report(year, paper);
    const head = [
      'symbol',
      'bought_on',
      'sold_on',
      'qty',
      'cost_usd',
      'proceeds_usd',
      'gain_usd',
      'cost_ils',
      'proceeds_ils',
      'sale_rate',
      'gain_ils',
      'gain_ils_dollar_method',
    ];
    const n = (x: number, d = 2) => x.toFixed(d);
    const rows = sales.map((s) =>
      [
        s.symbol,
        s.boughtOn.join(' '),
        s.soldOn,
        n(s.qty, 6),
        n(s.costUsd),
        n(s.proceedsUsd),
        n(s.gainUsd),
        n(s.costIls),
        n(s.proceedsIls),
        n(s.saleRate, 4),
        n(s.gainIls),
        n(s.realGainIls),
      ].join(','),
    );
    return [head.join(','), ...rows].join('\n') + '\n';
  }
}
