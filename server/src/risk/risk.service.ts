import type { trading } from '@alpacahq/alpaca-trade-api';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AlpacaService,
  type PlaceOrderInput,
} from '../alpaca/alpaca.service.js';
import type { Env } from '../config/env.js';
import { KillSwitchService } from './kill-switch.service.js';
import { RiskRejectedError } from './risk.errors.js';

const usd = (n: number) => `$${n.toFixed(2)}`;
const num = (value: string | number | null | undefined) => Number(value ?? 0);

/**
 * Pre-trade checks for every order. Orders that only shrink a long position
 * are always allowed (except by the kill switch and the rate limit), so a
 * limit can never trap you in a losing position.
 */
@Injectable()
export class RiskService {
  private readonly recentOrders: number[] = [];

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly alpaca: AlpacaService,
    private readonly killSwitch: KillSwitchService,
  ) {}

  /** Throws RiskRejectedError if the order breaks a rule. */
  async check(input: PlaceOrderInput, now = Date.now()): Promise<void> {
    const kill = await this.killSwitch.state();
    if (kill.engaged) this.reject(`kill switch engaged (${kill.reason})`);
    this.checkRate(now);

    const [account, positions] = await Promise.all([
      this.alpaca.getAccount(),
      this.alpaca.getPositions(),
    ]);
    const position = positions.find((p) => p.symbol === input.symbol);

    if (input.side === 'sell') {
      this.checkReducing(input, position);
    } else {
      const orderValue = await this.orderValue(input);
      this.checkIncreasingRisk(account, positions, position, orderValue);
    }

    this.recentOrders.push(now);
  }

  /** Long-only: a sell may only shrink an existing long position. */
  private checkReducing(
    input: PlaceOrderInput,
    position: trading.Position | undefined,
  ): void {
    const held = num(position?.qty);
    const exceeds =
      input.qty !== undefined
        ? num(input.qty) > held
        : num(input.notional) > num(position?.marketValue);
    if (held <= 0 || exceeds) {
      this.reject(
        `sell would open a short position in ${input.symbol} (long-only)`,
      );
    }
  }

  private checkIncreasingRisk(
    account: trading.Account,
    positions: trading.Position[],
    position: trading.Position | undefined,
    orderValue: number,
  ): void {
    const maxLoss = this.config.get('RISK_MAX_DAILY_LOSS', { infer: true });
    const dayPnl = num(account.equity) - num(account.lastEquity);
    if (dayPnl <= -maxLoss) {
      this.reject(
        `daily loss limit reached (${usd(dayPnl)}, limit -${usd(maxLoss)})`,
      );
    }

    const maxPosition = this.config.get('RISK_MAX_POSITION_VALUE', {
      infer: true,
    });
    const positionValue = num(position?.marketValue) + orderValue;
    if (positionValue > maxPosition) {
      this.reject(
        `position would be ${usd(positionValue)}, limit ${usd(maxPosition)}`,
      );
    }

    const maxExposure = this.config.get('RISK_MAX_TOTAL_EXPOSURE', {
      infer: true,
    });
    const exposure =
      positions.reduce((sum, p) => sum + Math.abs(num(p.marketValue)), 0) +
      orderValue;
    if (exposure > maxExposure) {
      this.reject(
        `total exposure would be ${usd(exposure)}, limit ${usd(maxExposure)}`,
      );
    }
  }

  private checkRate(now: number): void {
    const max = this.config.get('RISK_MAX_ORDERS_PER_MINUTE', { infer: true });
    while (this.recentOrders.length && this.recentOrders[0] <= now - 60_000) {
      this.recentOrders.shift();
    }
    if (this.recentOrders.length >= max) {
      this.reject(`more than ${max} orders in the last minute`);
    }
  }

  /** Estimated dollar value of the order (limit/stop price, else the latest trade). */
  private async orderValue(input: PlaceOrderInput): Promise<number> {
    if (input.notional !== undefined) return num(input.notional);
    const price =
      input.limitPrice ??
      input.stopPrice ??
      (await this.alpaca.getLatestPrice(input.symbol ?? ''));
    if (price === undefined) {
      this.reject(`no price available for ${input.symbol} to size the order`);
    }
    return num(input.qty) * num(price);
  }

  private reject(reason: string): never {
    throw new RiskRejectedError(reason);
  }
}
