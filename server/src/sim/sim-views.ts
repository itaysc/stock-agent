import type { trading } from '@alpacahq/alpaca-trade-api';
import { cents, shares } from './sim-fills.js';
import type { Quote } from './sim-market.service.js';
import type { SimAccountDoc, SimOrderDoc, SimPosition } from './sim.schema.js';

/** Alpaca sends amounts as strings. */
const str = (n: number | undefined | null) =>
  n === undefined || n === null ? null : String(n);

/** An order, as the Alpaca SDK returns it. */
export function orderView(o: SimOrderDoc): trading.Order {
  return {
    id: o._id,
    clientOrderId: o.clientOrderId,
    symbol: o.symbol,
    assetId: o.symbol,
    assetClass: 'us_equity',
    side: o.side,
    type: 'market',
    orderType: 'market',
    orderClass: 'simple',
    timeInForce: o.timeInForce,
    qty: str(o.qty),
    notional: str(o.notional),
    status: o.status,
    filledQty: String(o.filledQty ?? 0),
    filledAvgPrice: str(o.filledAvgPrice),
    createdAt: o.submittedAt,
    submittedAt: o.submittedAt,
    updatedAt: o.filledAt ?? o.canceledAt ?? o.submittedAt,
    filledAt: o.filledAt ?? null,
    canceledAt: o.canceledAt ?? null,
    failedAt: o.status === 'rejected' ? o.submittedAt : null,
    extendedHours: false,
    legs: null,
  } as trading.Order;
}

/** A holding, as the Alpaca SDK returns it (priced now and at the last close). */
export function positionView(
  p: SimPosition,
  q: Quote | undefined,
  selling: number,
): trading.Position {
  const price = q?.price ?? p.costBasis / p.qty;
  const lastClose = q?.lastClose ?? price;
  const value = cents(p.qty * price);
  const dayStart = cents(p.qty * lastClose);
  return {
    assetId: p.symbol,
    symbol: p.symbol,
    exchange: 'NASDAQ',
    assetClass: 'us_equity',
    assetMarginable: false,
    side: 'long',
    qty: String(p.qty),
    qtyAvailable: String(shares(p.qty - selling)),
    avgEntryPrice: String(cents(p.costBasis / p.qty)),
    costBasis: String(p.costBasis),
    currentPrice: String(price),
    lastdayPrice: String(lastClose),
    changeToday: String(lastClose ? (price - lastClose) / lastClose : 0),
    marketValue: String(value),
    unrealizedPl: String(cents(value - p.costBasis)),
    unrealizedPlpc: String(
      p.costBasis ? (value - p.costBasis) / p.costBasis : 0,
    ),
    unrealizedIntradayPl: String(cents(value - dayStart)),
    unrealizedIntradayPlpc: String(
      dayStart ? (value - dayStart) / dayStart : 0,
    ),
  } as trading.Position;
}

/** The account, as the Alpaca SDK returns it: a cash account (no margin). */
export function accountView(
  a: SimAccountDoc,
  quotes: Map<string, Quote>,
  reserved: number,
): trading.Account {
  const stocks = cents(
    a.positions.reduce(
      (s, p) =>
        s + p.qty * (quotes.get(p.symbol)?.price ?? p.costBasis / p.qty),
      0,
    ),
  );
  const equity = cents(a.cash + stocks);
  const buyingPower = String(cents(Math.max(0, a.cash - reserved)));
  return {
    id: a._id,
    accountNumber: a._id,
    status: 'ACTIVE',
    currency: 'USD',
    cash: String(a.cash),
    buyingPower,
    nonMarginableBuyingPower: buyingPower,
    regtBuyingPower: buyingPower,
    daytradingBuyingPower: '0',
    equity: String(equity),
    portfolioValue: String(equity),
    lastEquity: String(a.lastEquity),
    longMarketValue: String(stocks),
    shortMarketValue: '0',
    multiplier: '1',
    patternDayTrader: false,
    shortingEnabled: false,
    tradingBlocked: false,
    transfersBlocked: true,
    accountBlocked: false,
    tradeSuspendedByUser: false,
    createdAt: (a as { createdAt?: Date }).createdAt,
  } as trading.Account;
}
