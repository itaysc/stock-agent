import { makeBars } from '../../test/support/bars.js';
import type { AlpacaService } from '../alpaca/alpaca.service.js';
import { attachEarnings, attachNews } from './attach-info.js';
import { EarningsService } from './earnings.service.js';
import { headlineTone } from './headline-tone.js';
import { monthsBetween, NewsService } from './news.service.js';
import { beforeOpen, sessionDay } from './session-day.js';

/** A tiny in-memory stand-in for a Mongoose model (findOne/updateOne + lean). */
function fakeModel() {
  const docs: Array<Record<string, unknown>> = [];
  const match = (q: Record<string, unknown>) => (d: Record<string, unknown>) =>
    Object.entries(q).every(([k, v]) => d[k] === v);
  return {
    docs,
    findOne: (q: Record<string, unknown>) => ({
      lean: async () => docs.find(match(q)) ?? null,
    }),
    updateOne: async (
      q: Record<string, unknown>,
      u: { $set: Record<string, unknown> },
    ) => {
      const d = docs.find(match(q));
      if (d) Object.assign(d, u.$set);
      else docs.push({ ...q, ...u.$set });
    },
  };
}

describe('headline tone (sentiment library + finance words)', () => {
  it('reads finance headlines the right way round', () => {
    expect(
      headlineTone('Apple beats estimates, shares soar to record high'),
    ).toBeGreaterThan(0.5);
    expect(
      headlineTone('Apple faces antitrust lawsuit; shares fall'),
    ).toBeLessThan(-0.3);
    expect(
      headlineTone('Analyst downgrades Tesla, cuts price target'),
    ).toBeLessThan(-0.3);
    expect(headlineTone('Apple to hold event on Tuesday')).toBe(0);
  });
});

describe('news and earnings on bars', () => {
  it('counts a headline for the first close that could know it', () => {
    expect(sessionDay(new Date('2026-03-02T14:00:00Z'))).toBe('2026-03-02'); // 09:00 New York
    expect(sessionDay(new Date('2026-03-02T21:30:00Z'))).toBe('2026-03-03'); // after the 16:00 close
    expect(beforeOpen(new Date('2026-03-02T14:00:00Z'))).toBe(true); // 09:00: pre-market
    expect(beforeOpen(new Date('2026-03-02T15:00:00Z'))).toBe(false); // 10:00: in the session
    expect(beforeOpen(new Date('2026-03-02T21:30:00Z'))).toBe(true); // 16:30: after the close
    expect(
      monthsBetween(new Date('2025-11-15'), new Date('2026-01-02')),
    ).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('rolls weekend news into Monday and averages the tone', () => {
    // Bars dated like Alpaca's daily bars: 05:00 UTC = 00:00 New York (EST).
    const bars = [
      {
        ...makeBars('AAPL', [1])[0],
        timestamp: new Date('2026-01-09T05:00:00Z'),
      }, // Fri
      {
        ...makeBars('AAPL', [1])[0],
        timestamp: new Date('2026-01-12T05:00:00Z'),
      }, // Mon
    ];
    const news = new Map([
      ['2026-01-09', { sum: 0.5, count: 1, preSum: 0, preCount: 0 }],
      ['2026-01-10', { sum: -0.4, count: 2, preSum: 0, preCount: 0 }], // Saturday
      ['2026-01-12', { sum: 0.1, count: 1, preSum: 0.1, preCount: 1 }], // Monday, before the open
    ]);
    attachNews(bars, news);
    expect(bars[0].news).toEqual({
      tone: 0.5,
      count: 1,
      preTone: 0,
      preCount: 0,
    });
    expect(bars[1].news?.count).toBe(3);
    expect(bars[1].news?.tone).toBeCloseTo(-0.1);
    // Before Monday's open: the whole weekend plus Monday's pre-market headline.
    expect(bars[1].news?.preCount).toBe(3);
    expect(bars[1].news?.preTone).toBeCloseTo(-0.1);
  });

  it('knows the days to the next report and the last surprise', () => {
    const bars = [
      {
        ...makeBars('AAPL', [1])[0],
        timestamp: new Date('2026-01-12T05:00:00Z'),
      },
    ];
    attachEarnings(bars, [
      { date: '2025-10-30', surprisePct: 4.2 },
      { date: '2026-01-29', surprisePct: null }, // upcoming
    ]);
    expect(bars[0].earnings).toEqual({
      daysToNext: 17,
      daysSinceLast: 74,
      lastSurprisePct: 4.2,
    });
  });
});

describe('NewsService', () => {
  it('fetches every page of a month once, then reads finished months from the cache', async () => {
    const getNews = vi.fn(async ({ pageToken }: { pageToken?: string }) =>
      pageToken
        ? {
            news: [
              {
                headline: 'Apple shares plunge after lawsuit',
                createdAt: new Date('2025-06-03T15:00:00Z'),
              },
            ],
            nextPageToken: null,
          }
        : {
            news: [
              {
                headline: 'Apple beats estimates',
                createdAt: new Date('2025-06-02T15:00:00Z'),
              },
            ],
            nextPageToken: 'p2',
          },
    );
    const model = fakeModel();
    const service = new NewsService(
      { getNews } as unknown as AlpacaService,
      model as never,
    );
    const days = await service.daily(
      'AAPL',
      new Date('2025-06-01'),
      new Date('2025-06-20'),
    );
    expect(getNews).toHaveBeenCalledTimes(2);
    expect(days.get('2025-06-02')?.sum).toBeGreaterThan(0);
    expect(days.get('2025-06-03')?.sum).toBeLessThan(0);
    await service.daily('AAPL', new Date('2025-06-01'), new Date('2025-06-20'));
    expect(getNews).toHaveBeenCalledTimes(2); // June 2025 is over: cached
  });
});

describe('EarningsService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('needs an Alpha Vantage key, then merges past reports and upcoming dates', async () => {
    const off = new EarningsService(
      { get: () => '' } as never,
      fakeModel() as never,
    );
    await expect(off.reports('AAPL')).rejects.toThrow(/ALPHAVANTAGE_API_KEY/);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('EARNINGS_CALENDAR')
          ? new Response(
              'symbol,name,reportDate,fiscalDateEnding\nAAPL,Apple,2026-01-29,2025-12-31\n',
            )
          : Response.json({
              quarterlyEarnings: [
                { reportedDate: '2025-10-30', surprisePercentage: '4.2' },
              ],
            }),
      ),
    );
    const model = fakeModel();
    const on = new EarningsService(
      { get: () => 'demo-key' } as never,
      model as never,
    );
    expect(await on.reports('AAPL')).toEqual([
      { date: '2025-10-30', surprisePct: 4.2 },
      { date: '2026-01-29', surprisePct: null },
    ]);
    await on.reports('AAPL');
    expect(fetch).toHaveBeenCalledTimes(2); // cached for a week
  });
});
