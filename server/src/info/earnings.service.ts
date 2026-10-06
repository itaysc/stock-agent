import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Env } from '../config/env.js';
import type { EarningsResult } from '../paper/deployment-events.js';
import { EarningsDoc, type EarningsReport } from './earnings.schema.js';

const BASE = 'https://www.alphavantage.co/query';
const REFRESH_MS = 7 * 86_400_000;
/** The whole market's earnings calendar is one request: refreshed twice a day. */
const CALENDAR_MS = 12 * 3_600_000;
/** A symbol's latest results: asked again at most every 6 hours (the free plan allows ~25 requests a day). */
const LATEST_MS = 6 * 3_600_000;
const num = (x?: string) =>
  x !== undefined && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null;

interface EarningsResponse {
  quarterlyEarnings?: Array<{
    reportedDate?: string;
    reportedEPS?: string;
    estimatedEPS?: string;
    surprisePercentage?: string;
  }>;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
}

/** Past earnings (with surprise) and upcoming report dates, from Alpha Vantage; cached a week per symbol. */
@Injectable()
export class EarningsService {
  private calendarCache: { at: number; dates: Map<string, string[]> } | null =
    null;
  private readonly latestCache = new Map<
    string,
    { at: number; result: EarningsResult | null }
  >();

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectModel(EarningsDoc.name) private readonly docs: Model<EarningsDoc>,
  ) {}

  /** The symbol's next earnings day from `today` (YYYY-MM-DD) on, or null (unknown, or no key). */
  async nextReport(symbol: string, today: string): Promise<string | null> {
    if (!this.configured) return null;
    const calendar = await this.calendar();
    const dates =
      calendar.get(symbol) ?? calendar.get(symbol.replace('.', '-')) ?? [];
    return dates.find((d) => d >= today) ?? null;
  }

  /** Every company's report days in the next 3 months: one request, cached 12 hours. */
  private async calendar(): Promise<Map<string, string[]>> {
    if (this.calendarCache && Date.now() - this.calendarCache.at < CALENDAR_MS)
      return this.calendarCache.dates;
    const res = await fetch(
      `${BASE}?function=EARNINGS_CALENDAR&horizon=3month&apikey=${this.key}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    const [header, ...rows] = (await res.text()).trim().split('\n');
    const cols = header?.split(',') ?? [];
    const [sym, day] = [cols.indexOf('symbol'), cols.indexOf('reportDate')];
    if (sym < 0 || day < 0)
      throw new Error(`Alpha Vantage calendar: ${header?.slice(0, 200)}`);
    const dates = new Map<string, string[]>();
    for (const r of rows) {
      // Names can hold commas inside quotes ("AMERICA MOVIL, S.A.B."): drop them before splitting.
      const c = r.replace(/"[^"]*"/g, '').split(',');
      if (/^\d{4}-\d{2}-\d{2}$/.test(c[day] ?? ''))
        dates.set(c[sym], [...(dates.get(c[sym]) ?? []), c[day]].sort());
    }
    this.calendarCache = { at: Date.now(), dates };
    return dates;
  }

  /** The symbol's latest reported quarter (reported vs expected EPS), cached 6 hours. */
  async latestResult(symbol: string): Promise<EarningsResult | null> {
    if (!this.configured) return null;
    const hit = this.latestCache.get(symbol);
    if (hit && Date.now() - hit.at < LATEST_MS) return hit.result;
    const res = await fetch(
      `${BASE}?function=EARNINGS&symbol=${encodeURIComponent(symbol)}&apikey=${this.key}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const body = (await res.json()) as EarningsResponse;
    const problem = body.Note ?? body.Information ?? body['Error Message'];
    if (problem) throw new Error(`Alpha Vantage: ${problem}`);
    const q = body.quarterlyEarnings?.[0];
    const result = q?.reportedDate
      ? {
          date: q.reportedDate,
          reportedEps: num(q.reportedEPS),
          estimatedEps: num(q.estimatedEPS),
          surprisePct: num(q.surprisePercentage),
        }
      : null;
    this.latestCache.set(symbol, { at: Date.now(), result });
    return result;
  }

  get configured(): boolean {
    return this.key !== '';
  }

  private get key(): string {
    return this.config.get('ALPHAVANTAGE_API_KEY', { infer: true });
  }

  async reports(symbol: string): Promise<EarningsReport[]> {
    const cached = await this.docs.findOne({ symbol }).lean();
    if (
      cached &&
      Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_MS
    )
      return cached.reports;
    if (!this.configured) {
      throw new Error(
        'The earnings blocks need ALPHAVANTAGE_API_KEY in server/.env (free at alphavantage.co)',
      );
    }
    const [past, upcoming] = await Promise.all([
      this.past(symbol),
      this.upcoming(symbol),
    ]);
    const known = new Set(past.map((r) => r.date));
    const reports = [
      ...past,
      ...upcoming.filter((r) => !known.has(r.date)),
    ].sort((a, b) => a.date.localeCompare(b.date));
    await this.docs.updateOne(
      { symbol },
      { $set: { reports, fetchedAt: new Date() } },
      { upsert: true },
    );
    return reports;
  }

  private async past(symbol: string): Promise<EarningsReport[]> {
    const res = await fetch(
      `${BASE}?function=EARNINGS&symbol=${encodeURIComponent(symbol)}&apikey=${this.key}`,
      {
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = (await res.json()) as EarningsResponse;
    const problem = body.Note ?? body.Information ?? body['Error Message'];
    if (problem) throw new Error(`Alpha Vantage: ${problem}`);
    return (body.quarterlyEarnings ?? []).flatMap((q) =>
      q.reportedDate
        ? [
            {
              date: q.reportedDate,
              surprisePct: Number.isFinite(Number(q.surprisePercentage))
                ? Number(q.surprisePercentage)
                : null,
            },
          ]
        : [],
    );
  }

  /** Upcoming report dates (CSV: symbol,name,reportDate,...). ETFs have none. */
  private async upcoming(symbol: string): Promise<EarningsReport[]> {
    const res = await fetch(
      `${BASE}?function=EARNINGS_CALENDAR&symbol=${encodeURIComponent(symbol)}&horizon=3month&apikey=${this.key}`,
      {
        signal: AbortSignal.timeout(20_000),
      },
    );
    const [header, ...rows] = (await res.text()).trim().split('\n');
    const col = header?.split(',').indexOf('reportDate') ?? -1;
    if (col < 0) return [];
    return rows
      .map((r) => r.split(',')[col])
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .map((date) => ({ date, surprisePct: null }));
  }
}
