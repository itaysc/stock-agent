import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { headlineTone } from './headline-tone.js';
import { NEWS_FORMAT, type NewsDay, NewsMonth } from './news.schema.js';
import { beforeOpen, sessionDay } from './session-day.js';

export type DailyNews = Map<string, NewsDay>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** YYYY-MM for every month touching [from, to]. */
export function monthsBetween(from: Date, to: Date): string[] {
  const months: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (d <= to) {
    months.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months;
}

/**
 * Daily headline tone per symbol from Alpaca's news history, scored with the
 * `sentiment` library plus finance words. Finished months are cached in MongoDB.
 */
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly alpaca: AlpacaService,
    @InjectModel(NewsMonth.name) private readonly months: Model<NewsMonth>,
  ) {}

  async daily(symbol: string, from: Date, to: Date): Promise<DailyNews> {
    const out: DailyNews = new Map();
    for (const month of monthsBetween(from, to)) {
      const cached = await this.months.findOne({ symbol, month }).lean();
      const fresh = cached?.complete && cached.v === NEWS_FORMAT;
      const days = fresh ? cached.days : await this.fetchMonth(symbol, month);
      for (const [day, v] of Object.entries(days)) out.set(day, v);
    }
    return out;
  }

  private async fetchMonth(symbol: string, month: string) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const days: Record<string, NewsDay> = {};
    let pageToken: string | undefined;
    do {
      const page = await this.withRetry(() =>
        this.alpaca.getNews({ symbols: symbol, start, end, pageToken }),
      );
      for (const article of page.news) {
        const at = new Date(article.createdAt);
        const d = (days[sessionDay(at)] ??= {
          sum: 0,
          count: 0,
          preSum: 0,
          preCount: 0,
        });
        const tone = headlineTone(article.headline);
        d.sum += tone;
        d.count++;
        if (beforeOpen(at)) {
          d.preSum += tone;
          d.preCount++;
        }
      }
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
    // A month is final a day after it ends (late articles, time zones).
    const complete = end.getTime() + 86_400_000 < Date.now();
    await this.months.updateOne(
      { symbol, month },
      { $set: { days, complete, v: NEWS_FORMAT } },
      { upsert: true },
    );
    return days;
  }

  /** Waits and retries when Alpaca's rate limit is hit. */
  private async withRetry<T>(call: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await call();
      } catch (err) {
        if ((err as Error).name !== 'RateLimitError' || attempt >= 6) throw err;
        this.logger.warn(`News rate limit: waiting ${attempt * 5} s`);
        await sleep(attempt * 5_000);
      }
    }
  }
}
