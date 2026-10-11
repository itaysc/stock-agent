import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  boiRatesUrl,
  parseBoiCsv,
  rateFor,
  type DayRate,
} from './boi-rates.js';
import { UsdIlsRateDoc } from './tax-record.schema.js';

const DAY_MS = 86_400_000;
const shift = (day: string, days: number) =>
  new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10);

/** The official dollar rate of any day, from the Bank of Israel (cached in MongoDB). */
@Injectable()
export class UsdIlsService {
  constructor(
    @InjectModel(UsdIlsRateDoc.name)
    private readonly rates: Model<UsdIlsRateDoc>,
  ) {}

  /**
   * The rate for each day asked (that day's, or the last one published
   * before it). Fetches what the cache doesn't have, in one request.
   */
  async ratesFor(days: string[]): Promise<Map<string, DayRate>> {
    const out = new Map<string, DayRate>();
    if (!days.length) return out;
    const sorted = [...new Set(days)].sort();
    // A week before the first day covers a weekend or a holiday before it.
    const from = shift(sorted[0], -10);
    const to = sorted.at(-1) as string;
    let known = await this.cached(from, to);
    // A weekday without its own rate, or a weekend without Friday's: fetch (Israeli holidays have none, so they fall back to the day before).
    const missing = sorted.some((d) => {
      const r = rateFor(known, d);
      if (!r) return true;
      return isWeekend(d)
        ? Date.parse(d) - Date.parse(r.date) > 2 * DAY_MS
        : r.date !== d;
    });
    if (missing) {
      await this.fetch(from, to);
      known = await this.cached(from, to);
    }
    for (const d of sorted) {
      const r = rateFor(known, d);
      if (r) out.set(d, r);
    }
    return out;
  }

  private async cached(from: string, to: string): Promise<DayRate[]> {
    const docs = await this.rates
      .find({ date: { $gte: from, $lte: to } })
      .sort({ date: 1 })
      .lean();
    return docs.map((d) => ({ date: d.date, rate: d.rate }));
  }

  private async fetch(from: string, to: string): Promise<void> {
    const res = await fetch(boiRatesUrl(from, to), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Bank of Israel rates: HTTP ${res.status}`);
    const rows = parseBoiCsv(await res.text());
    if (!rows.length) return;
    await this.rates.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { date: r.date },
          update: { $set: { rate: r.rate } },
          upsert: true,
        },
      })),
    );
  }
}

const isWeekend = (day: string) => [0, 6].includes(new Date(day).getUTCDay());
