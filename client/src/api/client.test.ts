import { ApiError, api } from './client';

const respond = (status: number, body: string, type = 'application/json') =>
  vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': type } }));

describe('api client errors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks a down server (network error or plain-text proxy 502) as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(api.options()).rejects.toMatchObject({ unreachable: true });

    vi.stubGlobal('fetch', respond(502, '', 'text/plain'));
    await expect(api.options()).rejects.toMatchObject({ unreachable: true });
  });

  it('keeps real server errors, with their messages', async () => {
    vi.stubGlobal('fetch', respond(502, JSON.stringify({ message: 'Alpaca request failed: 429' })));
    const alpaca = await api.options().catch((e: ApiError) => e);
    expect(alpaca).toMatchObject({
      unreachable: false,
      message: 'Alpaca request failed: 429',
    });

    vi.stubGlobal(
      'fetch',
      respond(400, JSON.stringify({ message: ['invalid symbol', 'bad timeframe'] })),
    );
    await expect(api.backtest({})).rejects.toThrow('invalid symbol\nbad timeframe');
  });
});
