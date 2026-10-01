import type { StrategyBar } from '../strategy.types.js';
import type { Params } from './rule-checks.js';

/** News of the last `newsDays` bars, for the average headline tone. */
export class NewsWindow {
  private readonly days: Array<{ sum: number; count: number }> = [];

  constructor(private readonly size: number) {}

  add(bar: StrategyBar): { tone: number; count: number } {
    const news = bar.news ?? { tone: 0, count: 0 };
    this.days.push({ sum: news.tone * news.count, count: news.count });
    if (this.days.length > this.size) this.days.shift();
    const count = this.days.reduce((n, d) => n + d.count, 0);
    const sum = this.days.reduce((n, d) => n + d.sum, 0);
    return { tone: count ? sum / count : 0, count };
  }
}

/**
 * Fails loudly when a block needs information the bars don't carry, so a
 * missing data feed can't look like "the rule never fired".
 */
export function requireInfo(p: Params, bar: StrategyBar): void {
  if ((p.newsFilter || p.newsExit) && !bar.news) {
    throw new Error(
      'rules: the news blocks need news data, which was not loaded for this run',
    );
  }
  if ((p.earningsAvoid || p.surpriseMin || p.earningsExit) && !bar.earnings) {
    throw new Error(
      'rules: the earnings blocks need earnings data, which was not loaded for this run',
    );
  }
}
