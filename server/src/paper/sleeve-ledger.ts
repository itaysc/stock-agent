import { cleanQty } from '../strategies/qty.js';
import type { LedgerTrade, SleeveLedger } from './deployment.types.js';

export function emptyLedger(cash: number): SleeveLedger {
  return {
    cash,
    positions: {},
    trades: [],
    pending: [],
    realizedPnl: 0,
    lastPrices: {},
  };
}

/** Books a fill (or the new part of a partial fill) into the sleeve's sub-account. */
export function bookFill(
  ledger: SleeveLedger,
  fill: Omit<LedgerTrade, 'realizedPnl'>,
): LedgerTrade {
  const cost = fill.qty * fill.price;
  const held = ledger.positions[fill.symbol];
  const trade: LedgerTrade = { ...fill };
  if (fill.side === 'buy') {
    const qty = cleanQty((held?.qty ?? 0) + fill.qty);
    const avgPrice = ((held?.qty ?? 0) * (held?.avgPrice ?? 0) + cost) / qty;
    ledger.positions[fill.symbol] = { symbol: fill.symbol, qty, avgPrice };
    ledger.cash -= cost;
  } else {
    const qty = Math.min(fill.qty, held?.qty ?? 0);
    trade.realizedPnl = qty * (fill.price - (held?.avgPrice ?? fill.price));
    ledger.realizedPnl += trade.realizedPnl;
    ledger.cash += cost;
    const left = cleanQty((held?.qty ?? 0) - qty);
    if (left > 0 && held)
      ledger.positions[fill.symbol] = { ...held, qty: left };
    else delete ledger.positions[fill.symbol];
  }
  ledger.trades.push(trade);
  return trade;
}

/** Cash plus positions at their last known close. */
export function ledgerEquity(ledger: SleeveLedger): number {
  return Object.values(ledger.positions).reduce(
    (sum, p) => sum + p.qty * (ledger.lastPrices[p.symbol] ?? p.avgPrice),
    ledger.cash,
  );
}
