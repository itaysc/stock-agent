import { Injectable } from '@nestjs/common';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { attachEarnings, attachNews } from './attach-info.js';
import { EarningsService } from './earnings.service.js';
import { NewsService } from './news.service.js';

export interface InfoNeeds {
  news?: boolean;
  earnings?: boolean;
}

/** Adds news tone and earnings info to bars, for the strategies that use them. */
@Injectable()
export class InfoService {
  constructor(
    private readonly news: NewsService,
    private readonly earnings: EarningsService,
  ) {}

  get earningsAvailable(): boolean {
    return this.earnings.configured;
  }

  async enrich(
    bars: Record<string, StrategyBar[]>,
    range: { from: Date; to: Date },
    needs: InfoNeeds,
  ): Promise<void> {
    for (const [symbol, list] of Object.entries(bars)) {
      if (needs.news)
        attachNews(list, await this.news.daily(symbol, range.from, range.to));
      if (needs.earnings)
        attachEarnings(list, await this.earnings.reports(symbol));
    }
  }
}
