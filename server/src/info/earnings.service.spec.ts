import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { Env } from '../config/env.js';
import type { EarningsDoc } from './earnings.schema.js';
import { EarningsService } from './earnings.service.js';

const service = (key = 'k') =>
  new EarningsService(
    { get: () => key } as unknown as ConfigService<Env, true>,
    {} as Model<EarningsDoc>,
  );
const respond = (body: string) =>
  vi.fn(async () => new Response(body, { status: 200 }));

describe('EarningsService (the broker’s earnings check)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('finds the next report day in the whole-market calendar, with one request', async () => {
    const fetch = respond(
      'symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay\nAAPL,APPLE INCORPORATED,2026-10-29,2026-09-30,1.98,USD,\nAMX,"AMERICA MOVIL, SOCIEDAD ANÓNIMAB. DE C.V.",2026-10-21,2026-09-30,0.46,USD,\nBRK.B,BERKSHIRE HATHAWAY INCORPORATED,2026-11-06,2026-09-30,5.66,USD,\nAAPL,APPLE INCORPORATED,2027-01-28,2026-12-31,2.4,USD,pre-market',
    );
    vi.stubGlobal('fetch', fetch);
    const s = service();
    expect(await s.nextReport('AAPL', '2026-10-05')).toBe('2026-10-29');
    expect(await s.nextReport('AAPL', '2026-10-30')).toBe('2027-01-28');
    expect(await s.nextReport('BRK.B', '2026-10-05')).toBe('2026-11-06');
    expect(await s.nextReport('AMX', '2026-10-05')).toBe('2026-10-21'); // a name with a comma
    expect(await s.nextReport('MSFT', '2026-10-05')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reads the latest quarter: reported vs expected', async () => {
    vi.stubGlobal(
      'fetch',
      respond(
        JSON.stringify({
          quarterlyEarnings: [
            {
              reportedDate: '2026-07-30',
              reportedEPS: '1.57',
              estimatedEPS: '1.43',
              surprisePercentage: '9.79',
            },
          ],
        }),
      ),
    );
    expect(await service().latestResult('AAPL')).toEqual({
      date: '2026-07-30',
      reportedEps: 1.57,
      estimatedEps: 1.43,
      surprisePct: 9.79,
    });
  });

  it('does nothing without a key', async () => {
    const fetch = respond('');
    vi.stubGlobal('fetch', fetch);
    expect(await service('').nextReport('AAPL', '2026-10-05')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
