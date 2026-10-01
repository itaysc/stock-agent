import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Env } from '../config/env.js';
import { EarningsDoc, type EarningsReport } from './earnings.schema.js';

const BASE = 'https://www.alphavantage.co/query';
const REFRESH_MS = 7 * 86_400_000;

interface EarningsResponse {
  quarterlyEarnings?: Array<{
    reportedDate?: string;
    surprisePercentage?: string;
  }>;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
}

/** Past earnings (with surprise) and upcoming report dates, from Alpha Vantage; cached a week per symbol. */
@Injectable()
export class EarningsService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectModel(EarningsDoc.name) private readonly docs: Model<EarningsDoc>,
  ) {}

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
