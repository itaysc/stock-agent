import type { DeploymentStore } from '../paper/deployment-store.js';
import type { Deployment } from '../paper/deployment.types.js';
import type { DeploymentsService } from '../paper/deployments.service.js';
import { emptyLedger } from '../paper/sleeve-ledger.js';
import type { ResearchService } from '../research/research.service.js';
import type { ResearchSession } from '../research/research.types.js';
import { nextRunAt, nextSymbols } from './autopilot-helpers.js';
import { AutopilotSchedulerService } from './autopilot-scheduler.service.js';
import type { AutopilotStore } from './autopilot-store.js';
import { AutopilotService } from './autopilot.service.js';
import {
  type AutopilotRun,
  type AutopilotSettings,
  DEFAULT_SETTINGS,
} from './autopilot.types.js';
import type { NotifierService } from '../notify/notifier.service.js';
import { retireReason } from './retirement.js';

const deployment = (over: Partial<Deployment>): Deployment => ({
  id: 'd1',
  name: 'x',
  status: 'active',
  statusReason: null,
  source: { kind: 'autopilot' },
  timeframe: '1Day',
  capital: 10_000,
  sleeves: [
    { strategy: 'rules', symbols: ['IWM'], params: {}, weightPct: 100 },
  ],
  ledgers: [emptyLedger(10_000)],
  maxDrawdownPct: 15,
  lastBarAt: null,
  peakEquity: 10_000,
  snapshots: [],
  events: [],
  expectation: {
    from: new Date(),
    to: new Date(),
    annualPct: 10,
    maxDrawdownPct: 8,
    tradesPerYear: 5,
    holdAnnualPct: 12,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});
const session = (symbol: string, candidate: boolean) =>
  ({
    id: `r-${symbol}`,
    status: 'done',
    candidate,
    request: { symbols: [symbol] },
    holdout: {
      outcome: {
        returnPct: 12,
        holdReturnPct: 10,
        latestPick: { strategy: 'rules', params: { breakout: '20' } },
      },
      score: 0.5,
    },
    robustness: {
      summary: { verdict: 'Better than holding on 3 of 4 symbols' },
    },
  }) as unknown as ResearchSession;

describe('autopilot helpers', () => {
  it('rotates through the watchlist, skipping symbols already deployed', () => {
    const list = ['SPY', 'QQQ', 'IWM', 'DIA'];
    expect(nextSymbols(list, 0, 2, new Set())).toEqual({
      picked: ['SPY', 'QQQ'],
      next: 2,
    });
    expect(nextSymbols(list, 2, 2, new Set(['IWM']))).toEqual({
      picked: ['DIA', 'SPY'],
      next: 1,
    });
    expect(nextSymbols(list, 0, 9, new Set(list))).toEqual({
      picked: [],
      next: 0,
    });
    expect(nextRunAt(new Date('2026-01-01'), 7)).toEqual(
      new Date('2026-01-08'),
    );
    expect(nextRunAt(null, 7)).toBeNull();
  });

  it('retires only for a tripped guard, a deeper drop than expected, or lagging too long', () => {
    expect(retireReason(deployment({}), 40)).toBeNull();
    expect(
      retireReason(
        deployment({
          status: 'paused',
          statusReason: 'Guard: 16% below its peak',
        }),
        40,
      ),
    ).toMatch(/guard tripped/);
    expect(
      retireReason(
        deployment({ status: 'paused', statusReason: 'Paused by you' }),
        40,
      ),
    ).toBeNull();
    const deep = deployment({
      peakEquity: 10_000,
      ledgers: [{ ...emptyLedger(8_500) }],
    }); // -15% vs expected -8%
    expect(retireReason(deep, 40)).toMatch(/more than the backtest's worst/);
    expect(retireReason(deployment({ status: 'stopped' }), 40)).toBeNull();
  });
});

function setup(settings: Partial<AutopilotSettings>, live: Deployment[]) {
  let saved: AutopilotSettings = {
    ...DEFAULT_SETTINGS,
    enabled: true,
    ...settings,
  };
  const runs: AutopilotRun[] = [];
  const store = {
    settings: async () => ({ ...saved }),
    saveSettings: async (s: AutopilotSettings) => void (saved = s),
    saveRun: async (r: AutopilotRun) =>
      void runs.splice(0, runs.length, structuredClone(r)),
  } as unknown as AutopilotStore;
  const create = vi.fn(async (input: { name: string }) =>
    deployment({ id: `new-${input.name}`, name: input.name }),
  );
  const stop = vi.fn(async () => deployment({ status: 'stopped' }));
  const runNow = vi.fn(async (req: { symbols: string[] }) =>
    session(req.symbols[0], req.symbols[0] !== 'QQQ'),
  );
  const send = vi.fn(async () => undefined);
  const service = new AutopilotService(
    store,
    { create, stop } as unknown as DeploymentsService,
    { live: async () => live } as unknown as DeploymentStore,
    { runNow } as unknown as ResearchService,
    { send } as unknown as NotifierService,
  );
  const done = async () => {
    service.start('manual');
    await vi.waitFor(() => expect(service.running).toBeNull());
  };
  return {
    service,
    done,
    create,
    stop,
    runNow,
    send,
    runs,
    settings: () => saved,
  };
}

describe('AutopilotService', () => {
  it('retires its failing deployments, researches the next symbols and deploys what passes', async () => {
    const failing = deployment({
      id: 'bad',
      name: 'Autopilot: XLE',
      status: 'paused',
      statusReason: 'Guard: 20% below its peak',
    });
    const manual = deployment({
      id: 'mine',
      name: 'my own',
      source: { kind: 'manual' },
      status: 'paused',
      statusReason: 'Guard: 30%',
    });
    const { done, create, stop, runNow, send, runs, settings } = setup(
      { watchlist: ['SPY', 'QQQ', 'IWM'], symbolsPerRun: 2, groups: [] },
      [failing, manual],
    );
    await done();

    expect(stop).toHaveBeenCalledTimes(1); // never the manual one
    expect(stop).toHaveBeenCalledWith(
      'bad',
      expect.stringMatching(
        /^Retired by the autopilot: its safety guard tripped/,
      ),
    );
    expect(runNow.mock.calls.map(([r]) => r.symbols)).toEqual([
      ['SPY'],
      ['QQQ'],
    ]); // IWM is owned by a deployment
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Autopilot: SPY',
        capital: 10_000,
        source: { kind: 'autopilot', researchId: 'r-SPY' },
      }),
    );
    expect(runs[0].status).toBe('done');
    expect(runs[0].decisions.map((d) => d.kind)).toEqual([
      'retired',
      'kept',
      'researched',
      'deployed',
      'researched',
    ]);
    expect(settings()).toMatchObject({
      nextIndex: 2,
      lastRunAt: expect.any(Date),
    });
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('Paper-deployed SPY'),
    );
  });

  it('stays within its slots', async () => {
    const { done, create, runs } = setup(
      { watchlist: ['SPY'], maxDeployments: 1 },
      [deployment({ id: 'a' })],
    );
    await done();
    expect(create).not.toHaveBeenCalled();
    expect(runs[0].decisions.at(-1)).toMatchObject({
      kind: 'skipped',
      message: expect.stringMatching(/no free slot/),
    });
  });
});

describe('AutopilotService groups', () => {
  it('also researches one group per run as a whole, taking turns', async () => {
    const { done, runNow, settings } = setup(
      { watchlist: ['SPY'], symbolsPerRun: 1, groups: ['indexes', 'sectors'] },
      [],
    );
    await done();
    expect(runNow.mock.calls.map(([r]) => r.symbols)).toEqual([
      ['SPY'],
      ['SPY', 'QQQ', 'IWM', 'DIA'],
    ]);
    expect(settings().nextGroup).toBe(1);
  });
});

describe('AutopilotSchedulerService', () => {
  it('starts a run when due, otherwise only reviews', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      everyDays: 7,
      lastRunAt: new Date('2026-01-01'),
    };
    const autopilot = {
      running: null,
      start: vi.fn(),
      review: vi.fn(async () => []),
    };
    const scheduler = new AutopilotSchedulerService(
      { get: () => true } as never,
      {
        settings: async () => settings,
        saveRun: vi.fn(),
      } as unknown as AutopilotStore,
      autopilot as unknown as AutopilotService,
      { send: vi.fn() } as unknown as NotifierService,
    );
    await scheduler.tick(new Date('2026-01-05'));
    expect(autopilot.start).not.toHaveBeenCalled();
    expect(autopilot.review).toHaveBeenCalledTimes(1);
    await scheduler.tick(new Date('2026-01-08'));
    expect(autopilot.start).toHaveBeenCalledWith('schedule');
  });
});
