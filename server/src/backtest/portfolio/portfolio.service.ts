import { Injectable } from '@nestjs/common';
import {
  infoNeeds,
  usesMarket,
} from '../../strategies/rules/rules-validate.js';
import { createStrategy } from '../../strategies/strategy-registry.js';
import { BacktestService, validateRequest } from '../backtest.service.js';
import { runPortfolio } from './portfolio-engine.js';
import type {
  PortfolioRequest,
  PortfolioResult,
  Sleeve,
} from './portfolio.types.js';

export const MAX_SLEEVES = 10;

/** e.g. "40% rules on AAPL, MSFT (breakout=20 atrStop=3)" */
export function sleeveLabel(s: Sleeve): string {
  const params = Object.entries(s.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return `${s.weightPct}% ${s.strategy} on ${s.symbols.join(', ')}${params ? ` (${params})` : ''}`;
}

function normalize(s: Sleeve): Sleeve {
  return {
    ...s,
    symbols: [
      ...new Set(s.symbols.map((x) => x.trim().toUpperCase()).filter(Boolean)),
    ],
    params: Object.fromEntries(
      Object.entries(s.params ?? {}).map(([k, v]) => [k, String(v).trim()]),
    ),
  };
}

/** Portfolio backtest: several strategies with their own symbols and share of the money, on one clock. */
@Injectable()
export class PortfolioService {
  constructor(private readonly backtests: BacktestService) {}

  async run(request: PortfolioRequest): Promise<PortfolioResult> {
    validateRequest(request);
    const sleeves = request.sleeves.map(normalize);
    if (sleeves.length === 0 || sleeves.length > MAX_SLEEVES) {
      throw new Error(`A portfolio needs 1 to ${MAX_SLEEVES} sleeves`);
    }
    const total = sleeves.reduce((n, s) => n + s.weightPct, 0);
    if (sleeves.some((s) => !(s.weightPct > 0)) || total > 100 + 1e-9) {
      throw new Error(
        `Each sleeve needs a share above 0%, and together at most 100% (got ${total}%)`,
      );
    }
    const { maxDrawdownPct, cooldownDays } = request.risk;
    if (
      !(maxDrawdownPct >= 0 && maxDrawdownPct < 100) ||
      !(cooldownDays >= 0)
    ) {
      throw new Error(
        'Portfolio stop must be 0-99% (0 = off), cooldown 0 or more days',
      );
    }
    // Build the strategies first: bad params fail before any download.
    const parts = sleeves.map((sleeve, i) => {
      if (sleeve.symbols.length === 0)
        throw new Error(`Sleeve ${i + 1} has no symbols`);
      try {
        return {
          sleeve,
          label: sleeveLabel(sleeve),
          strategy: createStrategy(
            sleeve.strategy,
            sleeve.symbols,
            sleeve.params,
          ),
        };
      } catch (err) {
        throw new Error(
          `Sleeve ${i + 1} (${sleeve.strategy}): ${(err as Error).message}`,
        );
      }
    });
    const symbols = [...new Set(sleeves.flatMap((s) => s.symbols))];
    const needs = sleeves.map((s) =>
      infoNeeds([s.strategy], s.params, request.newsGateTone),
    );
    const bars = await this.backtests.fetchBars(symbols, request, {
      news: needs.some((n) => n.news),
      earnings: needs.some((n) => n.earnings),
    });
    const market = await this.backtests.fetchMarket(
      sleeves.some((s) => usesMarket([s.strategy], s.params)),
      request,
    );
    return runPortfolio(parts, bars, request, request.risk, market);
  }
}
