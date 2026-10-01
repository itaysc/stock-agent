import type { WalkForwardService } from '../backtest/walkforward/walkforward.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import { emptyLedger } from '../paper/sleeve-ledger.js';
import { dailyReport, fillMessage } from './broker-report.js';
import { healthCheck } from './broker-health.js';
import { brokerView, plainReason } from './broker-view.js';
import type { BrokerState } from './broker.types.js';
import { DEFAULT_PARAMS } from './universe.js';

const state: BrokerState = {
  deploymentId: 'd1',
  params: DEFAULT_PARAMS,
  lastReportAt: new Date('2026-10-01T21:00:00Z'),
  lastReportedBarAt: null,
  lastTune: null,
};

function deployment(): Deployment {
  const l = emptyLedger(10_000);
  l.cash = 2_000;
  l.positions = { NVDA: { symbol: 'NVDA', qty: 40, avgPrice: 100 } };
  l.lastPrices = { NVDA: 110 };
  l.trades = [
    {
      timestamp: new Date('2026-09-20T13:30:00Z'),
      symbol: 'XOM',
      side: 'buy',
      qty: 10,
      price: 100,
      reason: 'rank 3: +20.0% over 252 bars',
    },
    {
      timestamp: new Date('2026-10-02T13:30:00Z'),
      symbol: 'XOM',
      side: 'sell',
      qty: 10,
      price: 95,
      reason: 'left the top 5',
      realizedPnl: -50,
    },
    {
      timestamp: new Date('2026-10-02T13:30:00Z'),
      symbol: 'NVDA',
      side: 'buy',
      qty: 40,
      price: 100,
      reason: 'rank 1: +85.2% over 252 bars',
    },
  ];
  l.staged = [
    {
      symbol: 'AAPL',
      qty: 5,
      reason: 'rank 2: +30.0% over 252 bars',
      signalAt: new Date(),
    },
  ];
  return {
    id: 'd1',
    name: 'Broker',
    status: 'active',
    statusReason: null,
    source: { kind: 'broker' },
    timeframe: '1Day',
    capital: 10_000,
    sleeves: [
      {
        strategy: 'momentum-rotation',
        symbols: ['NVDA'],
        params: DEFAULT_PARAMS,
        weightPct: 100,
      },
    ],
    ledgers: [l],
    maxDrawdownPct: 36,
    expectation: null,
    lastBarAt: null,
    peakEquity: 10_000,
    snapshots: [],
    events: [
      {
        timestamp: new Date('2026-10-02T13:00:00Z'),
        message: 'Skipped buying 3 META: news tone -0.6',
      },
      {
        timestamp: new Date('2026-10-02T13:30:00Z'),
        message: 'Bought 40 NVDA at $100.00',
      },
    ],
    createdAt: new Date('2026-09-15'),
    updatedAt: new Date(),
  };
}

describe('broker view and report', () => {
  it('says why in plain words', () => {
    expect(plainReason('rank 1: +85.2% over 252 bars')).toBe(
      '#1 of 50: up 85.2% in 12 months',
    );
    expect(plainReason('left the top 5')).toBe('dropped out of the top 5');
    expect(plainReason('safe asset for 2 empty slots')).toBe(
      'parked in T-bills: too few stocks rising',
    );
  });

  it('shows holdings with the reason, and reports only what is new', () => {
    const v = brokerView(deployment(), state, 3.2);
    if (v.status === 'off') throw new Error('off');
    expect(v.equity).toBe(2_000 + 40 * 110);
    expect(v.holdings[0]).toMatchObject({
      symbol: 'NVDA',
      gainPct: expect.closeTo(10),
      why: '#1 of 50: up 85.2% in 12 months',
    });
    expect(
      v.activity.some(
        (a) =>
          a.text.startsWith('Bought 40 NVDA at $100.00') && a.kind === 'buy',
      ),
    ).toBe(true);
    expect(
      v.activity.filter((a) => a.kind === 'note').map((a) => a.text),
    ).toEqual(['Skipped buying 3 META: news tone -0.6']); // fills aren't doubled
    const ranked = brokerView(
      deployment(),
      state,
      3.2,
      {},
      { total: 50, rank: { NVDA: 1 }, wanted: ['NVDA'] },
    );
    if (ranked.status === 'off') throw new Error('off');
    const text = dailyReport(ranked, new Date(state.lastReportAt!));
    expect(text).toContain(
      '📊 Broker update: worth $6,400.00 (-36.0%, -$3,600.00 since start · SPY +3.2%) · cash $2,000.00',
    );
    expect(text).toContain(
      '🟢 NVDA · $110.00 (bought $100.00) · +10.0% (+$400.00)',
    );
    expect(text).toContain('   Strong #1 · sells below $75.00');
    expect(text).toContain(
      '• Sold 10 XOM at $95.00 (loss $50): dropped out of the top 5',
    );
    expect(text).toContain('• Buy 5 AAPL: #2 of 50: up 30.0% in 12 months');
    expect(text).toContain('cash $2,000.00\n\nYour stocks:'); // sections apart
    expect(text).not.toContain('\n\n\n');
    expect(text).not.toContain('Bought 10 XOM'); // before the last report
  });
});

describe('fill messages', () => {
  const t = { timestamp: new Date(), symbol: 'CAT', qty: 0.0597, price: 826.3 };
  it('says what it bought, at what price, why, and its stop', () => {
    expect(
      fillMessage(
        { ...t, side: 'buy', reason: 'rank 2: +87.6% over 252 bars' },
        25,
      ),
    ).toBe(
      [
        '✅ Bought 0.0597 CAT at $826.30 = $49.33',
        'Why: #2 of 50: up 87.6% in 12 months',
        'Stop loss: sells if it closes below $619.72 (25% under its highest close; it rises with the price).',
      ].join('\n'),
    );
    expect(
      fillMessage(
        { ...t, symbol: 'BIL', qty: 0.5, price: 91.5, side: 'buy' },
        25,
      ),
    ).toMatch(/^🅿️ Parked \$45.75 in T-bills/);
  });

  it('says what it sold, the profit or loss, and why', () => {
    expect(
      fillMessage(
        {
          ...t,
          side: 'sell',
          price: 900,
          realizedPnl: 4.4,
          reason: 'your profit target ($900.00): closed at $901.00',
        },
        25,
      ),
    ).toBe(
      [
        '💰 Sold 0.0597 CAT at $900.00 = $53.73 · profit +$4.40 (+8.9%)',
        'Why: your profit target ($900.00): closed at $901.00',
      ].join('\n'),
    );
    expect(
      fillMessage(
        {
          ...t,
          side: 'sell',
          price: 700,
          realizedPnl: -7.55,
          reason: 'stop: down 25.3% from its high',
        },
        25,
      ),
    ).toMatch(
      /^🔻 Sold .* · loss -\$7.55 \(-15.3%\)\nWhy: stop loss: fell 25.3% from its high since the buy$/,
    );
  });
});

describe('monthly health check', () => {
  const wf = (
    returnPct: number,
    holdReturnPct: number,
    params: Record<string, string>,
  ) =>
    ({
      run: vi.fn(async () => ({
        metrics: {
          totalReturnPct: returnPct,
          buyAndHoldReturnPct: holdReturnPct,
          maxDrawdownPct: 20,
          trades: 100,
          winRatePct: 60,
          profitFactor: 1.5,
          annualizedReturnPct: 30,
        },
        windows: Array.from({ length: 6 }, () => ({
          chosen: { strategy: 'momentum-rotation', params },
        })),
        efficiencyPct: 70,
        oosFrom: new Date('2023-10-01'),
        oosTo: new Date('2026-10-01'),
        outOfSampleAnnualPct: 30,
        buyAndHold: [],
        equityCurve: [],
        distinctSettings: 1,
        paramChanges: 0,
      })),
    }) as unknown as WalkForwardService;

  it('checks the fixed settings, and warns when they trail holding', async () => {
    const good = wf(120, 90, DEFAULT_PARAMS);
    expect(await healthCheck(good, DEFAULT_PARAMS, 10_000)).toEqual({
      ok: true,
      message:
        'Monthly check: the algo still works (last 3 years: +120.0% vs +90.0% holding all the stocks, worst drop -20.0%).',
    });
    expect(
      (good.run as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toMatchObject({
      grid: { lookback: ['252'], skipRecent: ['21'], topN: ['5'] },
    });
    const bad = await healthCheck(
      wf(50, 90, DEFAULT_PARAMS),
      DEFAULT_PARAMS,
      10_000,
    );
    expect(bad).toMatchObject({
      ok: false,
      message: expect.stringMatching(/^⚠️ .*trailed just holding/),
    });
  });
});
