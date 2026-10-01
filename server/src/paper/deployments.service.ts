import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { annualizedPct } from '../backtest/walkforward/walkforward-metrics.js';
import { PortfolioService } from '../backtest/portfolio/portfolio.service.js';
import type { Sleeve } from '../backtest/portfolio/portfolio.types.js';
import { deploymentEquity } from './deployment-cycle.js';
import { logEvent } from './deployment-events.js';
import { DeploymentRunnerService } from './deployment-runner.service.js';
import { DeploymentStore } from './deployment-store.js';
import {
  DEFAULT_NEWS_CHECK,
  type Deployment,
  type Expectation,
  type NewsCheck,
} from './deployment.types.js';
import { emptyLedger } from './sleeve-ledger.js';

export interface CreateDeployment {
  name: string;
  sleeves: Sleeve[];
  capital: number;
  /** Pause at this % below the peak; default: 1.5 × the backtest's worst drop (at least 10%). */
  maxDrawdownPct?: number;
  source?: Deployment['source'];
  /** Real-time news checks; default DEFAULT_NEWS_CHECK. */
  newsCheck?: NewsCheck;
  /**
   * false: the expectation backtest leaves out the news-tone part of the
   * check (live it still applies). Its news history is slow to fetch for many
   * big stocks (thousands of pages) and made no difference for them.
   */
  backtestNews?: boolean;
}

const YEAR_MS = 365.25 * 86_400_000;
const EXPECTATION_YEARS = 3;

/** Creates and manages paper deployments (the runner trades them). */
@Injectable()
export class DeploymentsService {
  constructor(
    private readonly alpaca: AlpacaService,
    private readonly portfolios: PortfolioService,
    private readonly runner: DeploymentRunnerService,
    private readonly store: DeploymentStore,
  ) {}

  async create(input: CreateDeployment): Promise<Deployment> {
    if (!this.alpaca.isPaper)
      throw new BadRequestException(
        'Paper trading only: the configured Alpaca account is LIVE.',
      );
    if (!(input.capital > 0))
      throw new BadRequestException('capital must be above 0');
    const live = await this.store.live();
    const owned = new Set(
      live.flatMap((d) => d.sleeves.flatMap((s) => s.symbols)),
    );
    const symbols = input.sleeves.flatMap((s) =>
      s.symbols.map((x) => x.toUpperCase()),
    );
    const taken = symbols.filter((s) => owned.has(s));
    if (taken.length)
      throw new BadRequestException(
        `Already traded by another deployment: ${[...new Set(taken)].join(', ')}`,
      );
    const held = (await this.alpaca.getPositions())
      .map((p) => p.symbol)
      .filter((s) => symbols.includes(s));
    if (held.length) {
      throw new BadRequestException(
        `The paper account already holds ${held.join(', ')} outside any deployment: close it first so they don't mix`,
      );
    }
    const free = await this.freeCash(live);
    if (input.capital > free) {
      throw new BadRequestException(
        `Not enough free paper cash: $${Math.floor(free).toLocaleString('en-US')} left after the other deployments`,
      );
    }

    // The same setup over recent years: what "normal" looks like, to compare live results with.
    const to = new Date();
    const from = new Date(to.getTime() - EXPECTATION_YEARS * YEAR_MS);
    const backtest = await this.portfolios
      .run({
        sleeves: input.sleeves,
        risk: { maxDrawdownPct: 0, cooldownDays: 0 },
        timeframe: '1Day',
        from,
        to,
        initialCash: input.capital,
        slippageBps: 5,
        feePerShare: 0,
        cashYieldPct: 0,
        // The news-tone part of the check can be backtested (the AI part can't).
        newsGateTone:
          input.backtestNews === false
            ? 0
            : (input.newsCheck ?? DEFAULT_NEWS_CHECK).tone,
      })
      .catch((err: Error) => {
        throw new BadRequestException(err.message);
      });
    const years = (to.getTime() - from.getTime()) / YEAR_MS;
    const expectation: Expectation = {
      from,
      to,
      annualPct: annualizedPct(backtest.metrics.totalReturnPct, from, to),
      maxDrawdownPct: backtest.metrics.maxDrawdownPct,
      tradesPerYear: backtest.metrics.trades / years,
      holdAnnualPct:
        backtest.benchmarkReturnPct === null
          ? null
          : annualizedPct(backtest.benchmarkReturnPct, from, to),
    };
    const now = new Date();
    const d: Deployment = {
      id: randomUUID(),
      name:
        input.name.trim() || backtest.sleeves.map((s) => s.label).join(' + '),
      status: 'active',
      statusReason: null,
      source: input.source ?? { kind: 'manual' },
      timeframe: '1Day',
      capital: input.capital,
      sleeves: backtest.sleeves.map((s) => s.sleeve),
      ledgers: backtest.sleeves.map((s) => emptyLedger(s.allocated)),
      newsCheck: input.newsCheck ?? DEFAULT_NEWS_CHECK,
      newsCheckedAt: null,
      maxDrawdownPct:
        input.maxDrawdownPct ??
        Math.max(10, Math.round(expectation.maxDrawdownPct * 1.5)),
      expectation,
      lastBarAt: null,
      peakEquity: input.capital,
      snapshots: [],
      events: [],
      createdAt: now,
      updatedAt: now,
    };
    logEvent(
      d,
      `Deployed with $${input.capital.toLocaleString('en-US')} of paper money. It acts on the latest close: orders go out for the next market open.`,
      now,
    );
    await this.store.save(d);
    await this.runner.cycle(d); // warm up the strategies now
    return d;
  }

  /** Paper cash not given to a live deployment yet. */
  async freeCash(live?: Deployment[]): Promise<number> {
    const [account, list] = await Promise.all([
      this.alpaca.getAccount(),
      live ?? this.store.live(),
    ]);
    return Number(account.cash ?? 0) - list.reduce((n, d) => n + d.capital, 0);
  }

  async setNewsCheck(id: string, newsCheck: NewsCheck): Promise<Deployment> {
    const d = await this.get(id);
    d.newsCheck = newsCheck;
    logEvent(
      d,
      `News check: ${newsCheck.tone > 0 ? `skip buys on news tone ≤ -${newsCheck.tone}` : 'tone check off'}, AI ${newsCheck.ai ? 'on' : 'off'}, breaking news: ${newsCheck.watch}`,
      new Date(),
    );
    await this.store.save(d);
    return d;
  }

  async get(id: string): Promise<Deployment> {
    const d = await this.store.get(id);
    if (!d) throw new NotFoundException(`No deployment ${id}`);
    return d;
  }

  list(): Promise<Deployment[]> {
    return this.store.list();
  }

  async pause(id: string): Promise<Deployment> {
    const d = await this.get(id);
    if (d.status !== 'active')
      throw new BadRequestException(`It is ${d.status}`);
    return this.setStatus(
      d,
      'paused',
      'Paused by you: no new orders; positions are kept',
    );
  }

  async resume(id: string): Promise<Deployment> {
    const d = await this.get(id);
    if (d.status !== 'paused')
      throw new BadRequestException(`It is ${d.status}`);
    d.peakEquity = deploymentEquity(d); // measure the next drawdown from here
    return this.setStatus(d, 'active', null, 'Resumed');
  }

  /** New settings for a sleeve's strategy: it re-warms on history and trades from the next day on. */
  async changeParams(
    id: string,
    sleeve: number,
    params: Record<string, string>,
    note: string,
  ): Promise<Deployment> {
    const d = await this.get(id);
    d.sleeves[sleeve] = { ...d.sleeves[sleeve], params };
    this.runner.forget(d.id);
    logEvent(d, note, new Date());
    await this.store.save(d);
    return d;
  }

  /** Sells everything and stops for good. */
  async stop(
    id: string,
    reason = 'Stopped by you: everything is being sold',
  ): Promise<Deployment> {
    const d = await this.get(id);
    if (d.status === 'stopped') return d;
    await this.runner.flatten(d, 'stopped');
    this.runner.forget(d.id);
    return this.setStatus(d, 'stopped', reason);
  }

  private async setStatus(
    d: Deployment,
    status: Deployment['status'],
    reason: string | null,
    note?: string,
  ): Promise<Deployment> {
    d.status = status;
    d.statusReason = reason;
    logEvent(d, note ?? reason ?? status, new Date());
    await this.store.save(d);
    return d;
  }
}
