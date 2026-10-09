import { cleanQty, roundQty } from '../strategies/qty.js';
import { TaxLedger } from './tax-ledger.js';
import type {
  Fill,
  OrderSide,
  Position,
  StrategyBar,
  StrategyContext,
} from '../strategies/strategy.types.js';

export interface BrokerOptions {
  initialCash: number;
  /** Price moves against us by this many basis points on every fill (5 = 0.05%). */
  slippageBps: number;
  /** Commission per share. Alpaca stock trades are commission-free, so 0 by default. */
  feePerShare: number;
  /**
   * Yearly interest on uninvested cash, in percent (3 = 3%), like a broker's
   * cash sweep or a money-market fund. Omitted = 0.
   */
  cashYieldPct?: number;
  /**
   * Pre-open news check: a buy is skipped when the headlines published before
   * its open (overnight, pre-market) average this negative or worse
   * (0.3 = tone -0.3). Needs bars with news. Omitted/0 = off.
   */
  newsGateTone?: number;
  /**
   * Fill the orders placed after a bar's close at that same close (like a
   * market-on-close order sent just before the closing auction), instead of
   * at the next bar's open. Omitted = the next open.
   */
  fillAtClose?: boolean;
  /**
   * Capital gains tax, in percent (25 = Israel's rate): each year's net
   * realized gains (and interest) are taxed when the year ends, losses carry
   * forward (see TaxLedger). Omitted/0 = no tax.
   */
  taxRatePct?: number;
  /**
   * Tax-loss harvesting (with taxRatePct): late each December, when the year
   * has a net gain to offset, sell the holdings below their cost and buy them
   * straight back (slippage both ways), so the loss counts this year. See
   * harvestLosses. Omitted = off.
   */
  harvestLosses?: boolean;
}

const YEAR_MS = 365.25 * 86_400_000;

interface PendingOrder {
  symbol: string;
  side: OrderSide;
  qty: number;
  reason?: string;
}

export interface Rejection extends PendingOrder {
  timestamp: Date;
  error: string;
}

/**
 * Simulated account for backtests. Orders placed on a bar fill at the NEXT
 * bar's open (plus slippage), so a strategy can never trade at a price it has
 * not seen yet. Long-only: sells never exceed the position. A buy that no
 * longer fits the cash at the fill price is reduced to what fits.
 */
export class SimulatedBroker implements StrategyContext {
  readonly fills: Fill[] = [];
  readonly rejections: Rejection[] = [];
  private cashBalance: number;
  private clock = new Date(0);
  private pending: PendingOrder[] = [];
  private readonly positions = new Map<string, Position>();
  private readonly lastPrices = new Map<string, number>();
  private lastAccrual: Date | null = null;
  private interest = 0;
  private readonly tax: TaxLedger | null;

  constructor(private readonly options: BrokerOptions) {
    this.cashBalance = options.initialCash;
    this.tax =
      (options.taxRatePct ?? 0) > 0
        ? new TaxLedger((options.taxRatePct as number) / 100)
        : null;
  }

  /** Tax paid so far (taxRatePct). */
  taxPaid(): number {
    return this.tax?.paid() ?? 0;
  }

  /** What the account would be worth after selling everything now and paying the tax due. */
  afterTaxEquity(): number {
    if (!this.tax) return this.equity();
    const unrealized = [...this.positions.values()].reduce(
      (n, p) =>
        n +
        p.qty * ((this.lastPrices.get(p.symbol) ?? p.avgPrice) - p.avgPrice),
      0,
    );
    return this.equity() - this.tax.ifSoldNow(unrealized);
  }

  /**
   * Sells every holding that is below its cost at its last close and buys it
   * straight back: the same shares, a lower cost, and a realized loss that
   * offsets this year's gains. Only when the year has a net gain (otherwise
   * the loss would just carry forward, for the cost of the trades).
   */
  harvestLosses(): void {
    if (!this.tax || this.tax.netThisYear() <= 0) return;
    for (const p of this.positions.values()) {
      const close = this.lastPrices.get(p.symbol);
      if (close === undefined) continue;
      const cost =
        (close * this.options.slippageBps) / 10_000 + this.options.feePerShare;
      if (close - cost >= p.avgPrice) continue;
      this.positions.set(p.symbol, { ...p, avgPrice: close + cost });
      this.cashBalance -= 2 * p.qty * cost;
      this.cashBalance -= this.tax.record(
        p.qty * (close - cost - p.avgPrice),
        this.clock,
      );
    }
  }

  setTime(timestamp: Date): void {
    this.clock = timestamp;
  }

  /**
   * Pays interest on idle cash for the time since the previous call
   * (calendar time, compounded). The first call only starts the clock.
   */
  accrueInterest(to: Date): void {
    // A new year: pay the tax on last year's net gains (sold from cash, which may go below 0 until the next re-check).
    this.cashBalance -= this.tax?.roll(to) ?? 0;
    const rate = (this.options.cashYieldPct ?? 0) / 100;
    if (this.lastAccrual && rate > 0 && this.cashBalance > 0) {
      const years = (to.getTime() - this.lastAccrual.getTime()) / YEAR_MS;
      const earned = this.cashBalance * ((1 + rate) ** years - 1);
      this.cashBalance += earned;
      this.interest += earned;
      this.cashBalance -= this.tax?.record(earned, to) ?? 0;
    }
    this.lastAccrual = to;
  }

  /** Interest paid on idle cash so far. */
  interestEarned(): number {
    return this.interest;
  }

  now(): Date {
    return this.clock;
  }

  cash(): number {
    return this.cashBalance;
  }

  position(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  openPositions(): Position[] {
    return [...this.positions.values()];
  }

  pendingOrders(): readonly PendingOrder[] {
    return this.pending;
  }

  buy(symbol: string, qty: number, reason?: string): void {
    this.place({ symbol, side: 'buy', qty, reason });
  }

  sell(symbol: string, qty: number, reason?: string): void {
    this.place({ symbol, side: 'sell', qty, reason });
  }

  /**
   * Fills this symbol's pending orders (of one side, when given) at the bar's
   * open. Call before the strategy sees the bar.
   */
  fillPending(bar: StrategyBar, side?: OrderSide): Fill[] {
    const mine = (o: PendingOrder) =>
      o.symbol === bar.symbol && (!side || o.side === side);
    const orders = this.pending.filter(mine);
    this.pending = this.pending.filter((o) => !mine(o));
    return orders.flatMap((order) => {
      const gate = this.options.newsGateTone ?? 0;
      const pre = bar.news;
      if (
        order.side === 'buy' &&
        gate > 0 &&
        pre &&
        pre.preCount > 0 &&
        pre.preTone <= -gate
      ) {
        this.reject(
          order,
          `bad news before the open (tone ${pre.preTone.toFixed(2)}, ${pre.preCount} headlines)`,
        );
        return [];
      }
      const fill = this.execute(order, bar.open);
      return fill ? [fill] : [];
    });
  }

  /** Drops orders that haven't filled yet. */
  cancelPending(): void {
    this.pending = [];
  }

  /** Records the bar's close as the symbol's current price (for equity). */
  markPrice(bar: StrategyBar): void {
    this.lastPrices.set(bar.symbol, bar.close);
  }

  equity(): number {
    let value = this.cashBalance;
    for (const p of this.positions.values()) {
      value += p.qty * (this.lastPrices.get(p.symbol) ?? p.avgPrice);
    }
    return value;
  }

  private place(order: PendingOrder): void {
    if (!Number.isFinite(order.qty) || order.qty <= 0) {
      this.reject(order, 'qty must be a positive number');
      return;
    }
    this.pending.push(order);
  }

  private execute(order: PendingOrder, open: number): Fill | undefined {
    const slip = (open * this.options.slippageBps) / 10_000;
    const price = order.side === 'buy' ? open + slip : open - slip;
    const held = this.positions.get(order.symbol);
    let qty = order.qty;
    let realizedPnl: number | undefined;

    if (order.side === 'buy') {
      const perShare = price + this.options.feePerShare;
      if (qty * perShare > this.cashBalance) {
        // The price opened above the level the order was sized at: buy
        // what the cash allows rather than dropping the whole signal.
        qty = roundQty(
          this.cashBalance / perShare,
          !Number.isInteger(order.qty),
        );
        if (qty <= 0) return this.reject(order, 'insufficient cash');
      }
      const cost = qty * perShare;
      const total = cleanQty((held?.qty ?? 0) + qty);
      const basis = (held ? held.qty * held.avgPrice : 0) + cost;
      this.positions.set(order.symbol, {
        symbol: order.symbol,
        qty: total,
        avgPrice: basis / total,
      });
      this.cashBalance -= cost;
    } else {
      // Float noise in fractional amounts (0.3 vs 0.29999999999999993) is not shorting.
      if (held && qty > held.qty && qty - held.qty < 1e-6) qty = held.qty;
      if (!held || qty > held.qty) {
        return this.reject(order, 'cannot sell more than held (no shorting)');
      }
      realizedPnl =
        qty * (price - held.avgPrice) - qty * this.options.feePerShare;
      const remaining = cleanQty(held.qty - qty);
      if (remaining <= 0) this.positions.delete(order.symbol);
      else this.positions.set(order.symbol, { ...held, qty: remaining });
      this.cashBalance += qty * (price - this.options.feePerShare);
      this.cashBalance -= this.tax?.record(realizedPnl, this.clock) ?? 0;
    }

    const reduced = order.side === 'buy' && qty !== order.qty;
    const fill: Fill = {
      symbol: order.symbol,
      side: order.side,
      qty,
      price,
      fee: qty * this.options.feePerShare,
      timestamp: this.clock,
      realizedPnl,
      requestedQty: reduced ? order.qty : undefined,
      reason: reduced
        ? `${order.reason ? `${order.reason} ` : ''}(reduced from ${order.qty} to fit cash)`
        : order.reason,
    };
    this.fills.push(fill);
    return fill;
  }

  private reject(order: PendingOrder, error: string): undefined {
    this.rejections.push({ ...order, timestamp: this.clock, error });
    return undefined;
  }
}
