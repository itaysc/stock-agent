import { BadRequestException, Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { BacktestService } from '../backtest/backtest.service.js';
import type { ChartRange } from '../broker/broker-chart-range.js';
import { stockChart } from '../broker/broker-charts.js';
import { openedAt } from '../broker/broker-levels.js';
import { EarningsService } from '../info/earnings.service.js';
import { LlmService } from '../llm/llm.service.js';
import { DeploymentStore } from '../paper/deployment-store.js';
import { AssetsService } from './assets.service.js';
import { categoryById, CATEGORIES } from './discover-categories.js';
import { MyStocksStore } from './my-stocks.store.js';
import { UsdIlsService } from '../tax/usd-ils.service.js';
import { nyDay, openBuys, paidInShekels } from './paid.js';
import { type NewsSummary, summarizeNews } from './news-summary.js';
import { rankTrending, type Trending } from './trending.js';

const DAY_MS = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const point = (b: { timestamp: Date; close: number }) => ({
  t: new Date(b.timestamp).toISOString(),
  c: b.close,
});

/** What the Trade page shows: quotes, charts, your stocks, discovery and news summaries. */
@Injectable()
export class TradeService {
  private discovered = new Map<string, { at: number; items: Trending[] }>();
  private summaries = new Map<string, { at: number; s: NewsSummary }>();

  constructor(
    private readonly alpaca: AlpacaService,
    private readonly backtests: BacktestService,
    private readonly assets: AssetsService,
    private readonly store: MyStocksStore,
    private readonly deployments: DeploymentStore,
    private readonly earnings: EarningsService,
    private readonly llm: LlmService,
    private readonly rates: UsdIlsService,
  ) {}

  /** A stock before you trade it: price, next earnings, and how much you and the broker hold. */
  async quote(symbol: string) {
    const s = symbol.toUpperCase();
    const [asset, trades, m, live] = await Promise.all([
      this.assets.find(s),
      this.alpaca.getLatestTrades([s]),
      this.store.get(),
      this.deployments.live(),
    ]);
    const today = day(new Date());
    const next = await this.earnings.nextReport(s, today).catch(() => null);
    const days = next
      ? Math.round((Date.parse(next) - Date.parse(today)) / DAY_MS)
      : null;
    return {
      symbol: s,
      asset,
      price: trades[s]?.price ?? null,
      priceAt: trades[s]?.at ?? null,
      earnings: next
        ? { date: next, inDays: days, soon: days !== null && days <= 7 }
        : null,
      mine: m.ledger.positions[s] ?? null,
      brokerQty: live.reduce(
        (n, d) =>
          n + d.ledgers.reduce((k, l) => k + (l.positions[s]?.qty ?? 0), 0),
        0,
      ),
    };
  }

  /** The price chart; for a stock you hold, with your buy price, buys and sells, and levels. */
  async chart(symbol: string, range: ChartRange, compare: boolean) {
    const s = symbol.toUpperCase();
    const m = await this.store.get();
    const p = m.ledger.positions[s];
    const bought = p ? openedAt(m.ledger.trades, s) : null;
    const base = await stockChart(
      this.backtests,
      null,
      s,
      range,
      compare,
      bought,
    );
    if (!p) return base;
    const from = base.closes[0]?.time ?? new Date(0);
    const levels = m.levels[s];
    return {
      ...base,
      entryPrice: p.avgPrice,
      boughtAt: bought,
      stopPrice: levels?.stopPrice ?? null,
      takeProfitPrice: levels?.takeProfitPrice ?? null,
      trades: m.ledger.trades
        .filter(
          (t) => t.symbol === s && new Date(t.timestamp) >= new Date(from),
        )
        .map((t) => ({
          time: t.timestamp,
          side: t.side,
          qty: t.qty,
          price: t.price,
          why: t.reason ?? '',
        })),
    };
  }

  /** Your stocks (with closes since a month before each buy), pending orders, watchlist and recent events. */
  async myStocks() {
    const m = await this.store.get();
    const held = Object.values(m.ledger.positions).map((p) => ({
      ...p,
      openedAt: openedAt(m.ledger.trades, p.symbol),
      levels: m.levels[p.symbol] ?? null,
    }));
    const now = Date.now();
    const starts = held.map(
      (h) => (h.openedAt ? +h.openedAt : now) - 30 * DAY_MS,
    );
    const from = new Date(Math.min(now - 92 * DAY_MS, ...starts));
    const symbols = [
      ...new Set([...held.map((h) => h.symbol), ...m.watchlist]),
    ];
    const bars = symbols.length
      ? await this.backtests.fetchBars(symbols, {
          timeframe: '1Day',
          from,
          to: new Date(),
        })
      : {};
    // What you paid: in dollars, and in shekels at each buy day's Bank of Israel rate.
    const buys = held.map((h) =>
      openBuys(m.ledger.trades, h.symbol, h.openedAt),
    );
    const rates = await this.rates
      .ratesFor(buys.flat().map((b) => nyDay(b.timestamp)))
      .catch(() => new Map<string, { rate: number }>());
    return {
      positions: held.map((h, i) => ({
        ...h,
        paidUsd: h.qty * h.avgPrice,
        paidIls: paidInShekels(buys[i], h.qty, (d) => rates.get(d)?.rate),
        lastClose: bars[h.symbol]?.at(-1)?.close ?? null,
        spark: (bars[h.symbol] ?? [])
          .filter((b) => +b.timestamp >= starts[i])
          .map(point),
      })),
      pending: m.ledger.pending,
      watchlist: m.watchlist.map((s) => ({
        symbol: s,
        lastClose: bars[s]?.at(-1)?.close ?? null,
        spark: (bars[s] ?? [])
          .filter((b) => +b.timestamp >= now - 92 * DAY_MS)
          .map(point),
      })),
      events: [...m.events].reverse().slice(0, 20),
    };
  }

  categories() {
    return CATEGORIES.map(({ id, name, symbols }) => ({
      id,
      name,
      count: symbols.length,
    }));
  }

  /** A category's stocks ranked by trend (cached for an hour). */
  async discover(id: string) {
    const c = categoryById(id);
    if (!c) throw new BadRequestException(`No category ${id}`);
    const hit = this.discovered.get(id);
    if (!hit || Date.now() - hit.at > 3_600_000) {
      const bars = await this.backtests.fetchBars(c.symbols, {
        timeframe: '1Day',
        from: new Date(Date.now() - 420 * DAY_MS),
        to: new Date(),
      });
      this.discovered.set(id, { at: Date.now(), items: rankTrending(bars) });
    }
    return {
      category: { id: c.id, name: c.name },
      items: this.discovered.get(id)?.items ?? [],
      note: "Ranked by the broker's rule (12-month rise, skipping the last month), rising trends first. A rules-based ranking from past prices, not advice.",
    };
  }

  /** The AI's summary of the last week's news on a stock (cached for 30 minutes). */
  async newsSummary(symbol: string): Promise<NewsSummary> {
    const s = symbol.toUpperCase();
    if (!this.llm.isConfigured())
      throw new BadRequestException(
        'Set OPENAI_API_KEY in server/.env for news summaries',
      );
    const hit = this.summaries.get(s);
    if (hit && Date.now() - hit.at < 30 * 60_000) return hit.s;
    const from = new Date(Date.now() - 7 * DAY_MS);
    const { news } = await this.alpaca.getNews({
      symbols: s,
      start: from,
      end: new Date(),
      newestFirst: true,
    });
    const summary = await summarizeNews(this.llm, s, news, from);
    this.summaries.set(s, { at: Date.now(), s: summary });
    return summary;
  }
}
