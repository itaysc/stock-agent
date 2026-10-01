import type { WalkForwardService } from '../backtest/walkforward/walkforward.service.js';
import type { NotifierService } from '../notify/notifier.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import { emptyLedger } from '../paper/sleeve-ledger.js';
import { BrokerNoticesService } from './broker-notices.service.js';
import type { BrokerStore } from './broker-store.js';
import type { BrokerState } from './broker.types.js';
import type { BrokerService } from './broker.service.js';

const trade = (symbol: string, side: 'buy' | 'sell') => ({
  timestamp: new Date(),
  symbol,
  side,
  qty: 1,
  price: 100,
  realizedPnl: side === 'sell' ? 5 : undefined,
});

function setup(notifiedTrades: number | undefined) {
  const l = emptyLedger(1_000);
  l.trades = [trade('CAT', 'buy'), trade('MRK', 'buy'), trade('CAT', 'sell')];
  const d = {
    ledgers: [l],
    sleeves: [{ params: { stopPct: '25' } }],
  } as unknown as Deployment;
  let state = { notifiedTrades } as BrokerState;
  const send = vi.fn(async () => undefined);
  const notices = new BrokerNoticesService(
    { deployment: async () => d } as unknown as BrokerService,
    {
      get: async () => state,
      save: async (s: BrokerState) => void (state = s),
    } as unknown as BrokerStore,
    {} as WalkForwardService,
    { send } as unknown as NotifierService,
  );
  return { notices, send, l, state: () => state };
}

describe('fill notices', () => {
  it('sends each new fill once', async () => {
    const { notices, send, l, state } = setup(1);
    await notices.notifyFills();
    expect(send).toHaveBeenCalledTimes(1);
    const text = (send.mock.calls[0] as unknown as [string])[0];
    expect(text).toMatch(/^✅ Bought 1 MRK at \$100.00 = \$100.00\n/);
    expect(text).toContain('\n\n💰 Sold 1 CAT at $100.00');
    expect(state().notifiedTrades).toBe(3);
    await notices.notifyFills();
    expect(send).toHaveBeenCalledTimes(1);
    l.trades.push(trade('NVDA', 'buy'));
    await notices.notifyFills();
    expect(send).toHaveBeenLastCalledWith(
      expect.stringMatching(/^✅ Bought 1 NVDA/),
    );
  });

  it('does not replay old trades for a broker started before fill notices', async () => {
    const { notices, send, state } = setup(undefined);
    await notices.notifyFills();
    expect(send).not.toHaveBeenCalled();
    expect(state().notifiedTrades).toBe(3);
  });
});
