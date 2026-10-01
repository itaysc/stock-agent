import type { CycleDeps, OfficialEvents } from './deployment-events.js';
import type { Deployment } from './deployment.types.js';
import { assessNews } from './news-assess.js';
import { releaseStaged, watchHeld } from './news-check.js';
import { emptyLedger } from './sleeve-ledger.js';

type Ai = { avoid: boolean; reason: string } | null;

function fakeDeps(opts: {
  news?: Record<string, string[]>;
  ai?: Ai;
  official?: Record<string, Partial<OfficialEvents>>;
}) {
  const aiNewsCheck = vi.fn(async () => opts.ai ?? null);
  const notify = vi.fn(async () => undefined);
  const deps = {
    recentNews: async (symbol: string) =>
      (opts.news?.[symbol] ?? []).map((headline) => ({
        headline,
        createdAt: new Date(),
      })),
    aiNewsCheck,
    officialEvents: async (symbol: string) => ({
      halt: null,
      filings: [],
      ...opts.official?.[symbol],
    }),
    opensSoon: async () => true,
    notify,
  } as unknown as CycleDeps;
  return { deps, aiNewsCheck, notify };
}
const check = (ai: boolean, watch: 'alert' | 'sell' = 'alert') => ({
  tone: 0.3,
  ai,
  watch,
});
const since = new Date(0);
const filing = (items: string[]) => ({
  form: '8-K',
  items,
  acceptedAt: new Date(),
  url: 'https://www.sec.gov/x',
});

describe('news assessment', () => {
  it('blocks on official facts without asking the AI: a trading halt, a severe 8-K', async () => {
    const halted = fakeDeps({
      ai: { avoid: false, reason: 'fine' },
      official: { AAA: { halt: { reasonCode: 'T1', reason: 'news pending' } } },
    });
    expect(
      await assessNews(check(true), halted.deps, 'AAA', since, 'buy'),
    ).toBe('trading in AAA is halted (news pending)');
    expect(halted.aiNewsCheck).not.toHaveBeenCalled();
    const bankrupt = fakeDeps({
      official: { AAA: { filings: [filing(['1.03', '9.01'])] } },
    });
    expect(
      await assessNews(check(false), bankrupt.deps, 'AAA', since, 'buy'),
    ).toMatch(
      /^AAA filed an 8-K with the SEC: item 1\.03: bankruptcy or receivership/,
    );
  });

  it('hands notable filings to the AI with the headlines', async () => {
    const { deps, aiNewsCheck } = fakeDeps({
      ai: { avoid: true, reason: 'The CFO left abruptly' },
      official: { AAA: { filings: [filing(['5.02'])] } },
    });
    expect(await assessNews(check(true), deps, 'AAA', since, 'hold')).toBe(
      'the AI flagged the news: The CFO left abruptly',
    );
    const [, headlines, , mode] = aiNewsCheck.mock.calls[0] as unknown as [
      string,
      Array<{ headline: string }>,
      string,
      string,
    ];
    expect(headlines[0].headline).toBe(
      '[SEC 8-K filing] item 5.02: departure or appointment of directors or officers',
    );
    expect(mode).toBe('company');
  });

  it('for an ETF: market-wide emergencies in its own news, then serious events at big holdings', async () => {
    const shock = fakeDeps({
      news: { SPY: ['Exchanges halt all trading after circuit breaker'] },
      ai: { avoid: true, reason: 'Market-wide circuit breaker' },
    });
    expect(await assessNews(check(true), shock.deps, 'SPY', since, 'buy')).toBe(
      'the AI sees a market-wide emergency: Market-wide circuit breaker',
    );
    expect(shock.aiNewsCheck.mock.calls[0]).toContain('market');

    const holding = fakeDeps({
      official: { XOM: { filings: [filing(['4.02'])] } },
    });
    expect(
      await assessNews(check(false), holding.deps, 'XLE', since, 'buy'),
    ).toMatch(
      /^XOM \(about 23% of the fund\): XOM filed an 8-K with the SEC: item 4\.02: past financial statements/,
    );
    // Gloomy market headlines alone don't block a fund (no tone check for funds).
    const gloomy = fakeDeps({
      news: { SPY: ['Stocks fall, Nasdaq slumps as yields jump'] },
    });
    expect(
      await assessNews(check(false), gloomy.deps, 'SPY', since, 'buy'),
    ).toBeNull();
  });

  it('for a hold, only asks the AI when something alarming showed up', async () => {
    const quiet = fakeDeps({
      news: { AAA: ['AAA to present at a conference'] },
      ai: { avoid: true, reason: 'x' },
    });
    expect(
      await assessNews(check(true), quiet.deps, 'AAA', since, 'hold'),
    ).toBeNull();
    expect(quiet.aiNewsCheck).not.toHaveBeenCalled();
  });
});

describe('releaseStaged / watchHeld', () => {
  function deployment(watch: 'alert' | 'sell', ai: boolean) {
    const ledger = emptyLedger(1_000);
    ledger.positions.AAA = { symbol: 'AAA', qty: 10, avgPrice: 50 };
    ledger.staged = [{ symbol: 'BBB', qty: 5, signalAt: new Date() }];
    return {
      id: 'x',
      name: 'test',
      status: 'active',
      ledgers: [ledger],
      events: [],
      newsCheck: check(ai, watch),
    } as unknown as Deployment;
  }

  it('skips a waiting buy the AI vetoes, and sends a clean one', async () => {
    const d = deployment('alert', true);
    const send = vi.fn(async () => undefined);
    await releaseStaged(
      d,
      fakeDeps({
        news: { BBB: ['BBB CEO steps down'] },
        ai: { avoid: true, reason: 'The CEO resigned unexpectedly' },
      }).deps,
      new Date(),
      send,
    );
    expect(send).not.toHaveBeenCalled();
    expect(d.events.at(-1)?.message).toBe(
      'Skipped buying 5 BBB: the AI flagged the news: The CEO resigned unexpectedly',
    );
    const clean = deployment('alert', false);
    await releaseStaged(clean, fakeDeps({}).deps, new Date(), send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('alerts on a halted holding, and sells when set to', async () => {
    const official = {
      AAA: { halt: { reasonCode: 'H10', reason: 'SEC trading suspension' } },
    };
    const alert = fakeDeps({ official });
    expect(
      await watchHeld(deployment('alert', false), alert.deps, new Date()),
    ).toEqual([]);
    expect(alert.notify).toHaveBeenCalledWith(
      'test: Breaking news on AAA (held: 10): trading in AAA is halted (SEC trading suspension)',
    );
    expect(
      await watchHeld(
        deployment('sell', false),
        fakeDeps({ official }).deps,
        new Date(),
      ),
    ).toEqual([{ sleeve: 0, symbol: 'AAA', qty: 10, why: 'breaking news' }]);
  });
});
