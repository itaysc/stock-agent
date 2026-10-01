import type { NotifierService } from '../../notify/notifier.service.js';
import type { DeploymentsService } from '../../paper/deployments.service.js';
import type { ResearchSession } from '../../research/research.types.js';
import type { IdeaStore } from './idea-store.js';
import type { Idea } from './idea.types.js';
import { IdeasService } from './ideas.service.js';

const session = {
  id: 'r1',
  status: 'done',
  candidate: true,
  request: {
    symbols: ['SPY'],
    from: new Date('2021-10-01'),
    to: new Date('2026-10-01'),
  },
  experiments: Array(12).fill({}),
  holdout: {
    outcome: {
      returnPct: 12.3,
      holdReturnPct: 8.1,
      maxDrawdownPct: 6.2,
      holdMaxDrawdownPct: 10.4,
      trades: 14,
      winRatePct: 64,
      latestPick: { strategy: 'rules', params: { breakout: '20' } },
    },
    score: 0.4,
  },
  robustness: { summary: { verdict: 'Better than holding on 3 of 4 symbols' } },
  verdict: { headline: 'A steady trend follower' },
} as unknown as ResearchSession;

function setup(create = vi.fn(async () => ({ id: 'd1' }))) {
  const ideas = new Map<string, Idea>();
  const store = {
    save: async (i: Idea) => void ideas.set(i.id, structuredClone(i)),
    get: async (id: string) => ideas.get(id) ?? null,
    pending: async () =>
      [...ideas.values()].filter((i) => i.status === 'pending'),
  } as unknown as IdeaStore;
  const send = vi.fn(async () => undefined);
  const service = new IdeasService(
    store,
    { create } as unknown as DeploymentsService,
    { send } as unknown as NotifierService,
  );
  return { service, ideas, send, create };
}

describe('IdeasService', () => {
  it('sends the evidence with Invest / Skip buttons', async () => {
    const { service, send } = setup();
    const idea = await service.propose(session, 'SPY', 10_000);
    expect(idea.id).toMatch(/^[0-9a-f]{4}$/);
    const [text, buttons] = send.mock.calls[0] as unknown as [string, unknown];
    expect(text).toContain(`💡 Idea ${idea.id}: SPY`);
    expect(text).toContain('Trades: rules (breakout=20)');
    expect(text).toContain('+12.3% vs +8.1% for just holding');
    expect(text).toContain('Worst drop: -6.2% vs -10.4% holding');
    expect(text).toContain('12 setups over 5 years');
    expect(text).toContain(
      'How much paper money? Tap Invest to choose (suggested $10,000)',
    );
    expect(buttons).toEqual([
      { text: '💰 Invest… (paper)', data: `invest:${idea.id}` },
      { text: '❌ Skip', data: `skip:${idea.id}` },
    ]);
  });

  it('paper-deploys only on your yes, once, with your amount', async () => {
    const { service, create, ideas } = setup();
    const idea = await service.propose(session, 'SPY', 10_000);
    const [a, b] = await Promise.all([
      service.invest(idea.id.toUpperCase(), 5_000),
      service.invest(idea.id),
    ]);
    expect(a).toMatch(/^✅ Paper-deployed SPY with \$5,000/);
    expect(b).toMatch(/Already investing/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        capital: 5_000,
        source: { kind: 'autopilot', researchId: 'r1' },
        sleeves: [expect.objectContaining({ symbols: ['SPY'] })],
      }),
    );
    expect(ideas.get(idea.id)).toMatchObject({
      status: 'invested',
      deploymentId: 'd1',
    });
    expect(await service.invest(idea.id)).toMatch(/already invested/);
  });

  it('keeps an idea open when the deploy fails, and expires stale ones', async () => {
    const { service, ideas } = setup(
      vi.fn(async () => {
        throw new Error('Not enough free paper cash');
      }),
    );
    const idea = await service.propose(session, 'SPY', 10_000);
    expect(await service.invest(idea.id)).toBe(
      'Could not invest in SPY: Not enough free paper cash',
    );
    expect(ideas.get(idea.id)?.status).toBe('pending');
    const later = new Date(Date.now() + 4 * 86_400_000);
    expect(await service.invest(idea.id, undefined, later)).toMatch(/expired/);
    expect(await service.skip('zzzz')).toMatch(/No idea "zzzz"/);
  });

  it('replaces an older open idea on the same symbols', async () => {
    const { service, ideas } = setup();
    const first = await service.propose(session, 'SPY', 10_000);
    const second = await service.propose(session, 'SPY', 10_000);
    expect(ideas.get(first.id)?.status).toBe('replaced');
    expect((await service.pending()).map((i) => i.id)).toEqual([second.id]);
  });
});
