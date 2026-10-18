import type { CycleDeps } from './deployment-events.js';
import type { Deployment } from './deployment.types.js';
import { industryNotice, industryVeto } from './industry-check.js';

function setup(
  industry: 'off' | 'trial' | 'on' | undefined,
  news: Record<string, string[]>,
  avoid = true,
) {
  const aiNewsCheck = vi.fn(async () => ({
    avoid,
    reason: 'new US export controls on chip equipment to China',
  }));
  const notify = vi.fn(async () => undefined);
  const deps = {
    recentNews: async (s: string) =>
      (news[s] ?? []).map((headline) => ({ headline, createdAt: new Date() })),
    aiNewsCheck,
    notify,
  } as unknown as CycleDeps;
  const d = {
    name: 'Broker',
    events: [],
    newsCheck: { tone: 0.3, ai: true, watch: 'alert', industry },
  } as unknown as Deployment;
  return { d, deps, aiNewsCheck, notify };
}
const now = new Date('2026-10-14T13:00:00Z');
const since = new Date('2026-10-12T20:00:00Z');
const shock = { LRCX: ['US widens export ban on chip-making tools'] };

describe('industry check before a buy', () => {
  it('in the trial (the default) only logs what it would have skipped', async () => {
    const s = setup(undefined, shock);
    expect(await industryVeto(s.d, s.deps, 'AMAT', since, now)).toBeNull();
    expect(s.d.events[0].message).toMatch(
      /trial, not acted on.*AMAT.*chip equipment.*export controls/,
    );
    // The AI read the peers' and the fund's news, in its industry mode.
    expect(s.aiNewsCheck.mock.calls[0]).toEqual([
      expect.stringContaining('AMAT (chip equipment'),
      expect.any(Array),
      'buy',
      'industry',
    ]);
  });

  it('when on, the shock is a reason to skip the buy', async () => {
    const s = setup('on', shock);
    expect(await industryVeto(s.d, s.deps, 'AMAT', since, now)).toMatch(
      /industry-wide shock/,
    );
  });

  it('does nothing when off, without peers news, or for a stock without a known industry', async () => {
    for (const [mode, symbol, news] of [
      ['off', 'AMAT', shock],
      ['trial', 'AMAT', {}],
      ['trial', 'ZZZZ', shock],
    ] as const) {
      const s = setup(mode, news);
      expect(await industryVeto(s.d, s.deps, symbol, since, now)).toBeNull();
      expect(s.aiNewsCheck).not.toHaveBeenCalled();
    }
  });
});

describe('industry notice for a holding', () => {
  it('asks the AI only on alarming headlines, and notifies once a day per industry', async () => {
    const calm = setup('trial', {
      LRCX: ['Lam Research to present at conference'],
    });
    await industryNotice(calm.d, calm.deps, 'AMAT', since, now);
    expect(calm.aiNewsCheck).not.toHaveBeenCalled();

    const s = setup('trial', {
      LRCX: ['Chip equipment makers plunge after sweeping export ban'],
    });
    await industryNotice(s.d, s.deps, 'AMAT', since, now);
    await industryNotice(s.d, s.deps, 'AMAT', since, now);
    expect(s.notify).toHaveBeenCalledTimes(1);
    expect(s.d.events[0].message).toMatch(/notice only: the rules decide/);
  });
});
