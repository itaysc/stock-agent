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
const investment = (id: string, name: string, symbols: string[]) => {
  const l = emptyLedger(1_000);
  l.trades = symbols.map((s) => trade(s, 'buy'));
  return {
    id,
    name,
    ledgers: [l],
    sleeves: [{ params: { stopPct: '25' } }],
  } as unknown as Deployment;
};

function setup(list: Deployment[], state: Partial<BrokerState>) {
  let saved = { deploymentId: null, ...state } as BrokerState;
  const send = vi.fn(async () => undefined);
  const notices = new BrokerNoticesService(
    { investments: async () => list } as unknown as BrokerService,
    {
      get: async () => saved,
      save: async (s: BrokerState) => void (saved = s),
    } as unknown as BrokerStore,
    {} as WalkForwardService,
    { send } as unknown as NotifierService,
  );
  return { notices, send, state: () => saved };
}

describe('fill notices', () => {
  it('sends each new fill once, per investment, labelled when there are several', async () => {
    const a = investment('a', 'Aggressive · $1,000', ['CAT', 'MRK']);
    const b = investment('b', 'Careful · $5,000', ['SPY']);
    const { notices, send, state } = setup([a, b], {
      notified: { a: 1, b: 0 },
    });
    await notices.notifyFills();
    const text = (send.mock.calls[0] as unknown as [string])[0];
    expect(text).toMatch(/^Aggressive · \$1,000: ✅ Bought 1 MRK at \$100.00/);
    expect(text).toContain('\n\nCareful · $5,000: ✅ Bought 1 SPY');
    expect(state().notified).toEqual({ a: 2, b: 1 });
    await notices.notifyFills();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('carries over an older single investment, and does not replay trades it never counted', async () => {
    const old = investment('old', 'Broker', ['CAT', 'MRK', 'AMD']);
    const fresh = investment('new', 'Balanced · $2,000', ['NVDA']);
    const { notices, send, state } = setup([old, fresh], {
      deploymentId: 'old',
      notifiedTrades: 2,
    });
    await notices.notifyFills();
    const text = (send.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain('AMD'); // the old one's third trade was not sent yet
    expect(text).not.toContain('NVDA'); // unknown to the state: start from now
    expect(state().notified).toEqual({ old: 3, new: 1 });
  });
});
