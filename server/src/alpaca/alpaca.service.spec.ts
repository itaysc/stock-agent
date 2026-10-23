import { TimeFrame } from '@alpacahq/alpaca-trade-api';
import {
  createMockAlpaca,
  type MockRequest,
  type MockRoute,
} from '@alpacahq/alpaca-trade-api/testing';
import type { ConfigService } from '@nestjs/config';
import type { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import { fakeAccount, inAccount } from '../accounts/testing.js';
import type { Env } from '../config/env.js';
import { AlpacaService } from './alpaca.service.js';

const config = {
  get: (key: keyof Env) => ({ ALPACA_DATA_FEED: 'iex' })[key as string],
} as unknown as ConfigService<Env, true>;

function createService(routes: MockRoute[], paper = true) {
  const client = createMockAlpaca(routes, { paper, retry: false });
  const accounts = { dataClient: () => client } as unknown as AlpacaAccounts;
  const service = new AlpacaService(accounts, config);
  return inAccount(service, { ...fakeAccount('PA1', client), paper });
}

describe('AlpacaService', () => {
  it('reports paper vs live mode', () => {
    expect(createService([], true).isPaper).toBe(true);
    expect(createService([], false).isPaper).toBe(false);
  });

  describe('placeOrder', () => {
    const order = {
      type: 'market',
      side: 'buy',
      symbol: 'AAPL',
      qty: 1,
      clientOrderId: 'strat-1-0001',
    } as const;

    it('submits the order with its clientOrderId', async () => {
      let body: Record<string, unknown> = {};
      const service = createService([
        {
          method: 'POST',
          path: '/v2/orders',
          respond: (req: MockRequest) => {
            body = JSON.parse(req.init?.body as string);
            return { id: 'ord-1', client_order_id: body.client_order_id };
          },
        },
      ]);

      const result = await service.placeOrder(order);

      expect(result.id).toBe('ord-1');
      expect(body).toMatchObject({
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        qty: '1',
        client_order_id: 'strat-1-0001',
      });
    });

    it('reconciles by clientOrderId when placement is ambiguous', async () => {
      let lookedUp: string | null = null;
      const service = createService([
        {
          method: 'POST',
          path: '/v2/orders',
          respond: () => {
            throw new Error('socket hang up');
          },
        },
        {
          method: 'GET',
          path: '/v2/orders:by_client_order_id',
          respond: (req: MockRequest) => {
            lookedUp = req.url.searchParams.get('client_order_id');
            return { id: 'ord-1', client_order_id: lookedUp };
          },
        },
      ]);

      const result = await service.placeOrder(order);

      expect(lookedUp).toBe('strat-1-0001');
      expect(result.id).toBe('ord-1');
    });

    it('rethrows when the ambiguous order cannot be found', async () => {
      const service = createService([
        {
          method: 'POST',
          path: '/v2/orders',
          respond: () => {
            throw new Error('socket hang up');
          },
        },
      ]);

      await expect(service.placeOrder(order)).rejects.toMatchObject({
        name: 'FetchError',
      });
    });

    it('does not reconcile API rejections', async () => {
      const service = createService([
        {
          method: 'POST',
          path: '/v2/orders',
          status: 403,
          body: { message: 'insufficient buying power' },
        },
      ]);

      await expect(service.placeOrder(order)).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  it('fetches bars using the configured data feed', async () => {
    let feed: string | null = null;
    const service = createService([
      {
        path: '/v2/stocks/bars',
        respond: (req: MockRequest) => {
          feed = req.url.searchParams.get('feed');
          return {
            bars: {
              AAPL: [
                {
                  t: '2026-09-24T00:00:00Z',
                  o: 1,
                  h: 2,
                  l: 0.5,
                  c: 1.5,
                  v: 100,
                },
              ],
            },
            next_page_token: null,
          };
        },
      },
    ]);

    const bars = await service.getBars('AAPL', { timeframe: TimeFrame.Day });

    expect(feed).toBe('iex');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ open: 1, close: 1.5, volume: 100 });
  });

  it('fetches many symbols in one request, and waits and retries when rate-limited', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls: string[] = [];
    const bar = {
      t: '2026-09-24T00:00:00Z',
      o: 1,
      h: 2,
      l: 0.5,
      c: 1.5,
      v: 100,
    };
    const service = createService([
      {
        path: '/v2/stocks/bars',
        respond: (req: MockRequest) => {
          calls.push(req.url.searchParams.get('symbols') ?? '');
          if (calls.length === 1)
            return new Response('{"message":"too many requests."}', {
              status: 429,
            });
          return { bars: { AAPL: [bar], MSFT: [bar] }, next_page_token: null };
        },
      },
    ]);
    const pending = service.getBarsMany(['AAPL', 'MSFT'], {
      timeframe: TimeFrame.Day,
    });
    await vi.advanceTimersByTimeAsync(6_000);
    const bars = await pending;
    vi.useRealTimers();
    expect(calls).toEqual(['AAPL,MSFT', 'AAPL,MSFT']);
    expect(Object.keys(bars)).toEqual(['AAPL', 'MSFT']);
  });
});
