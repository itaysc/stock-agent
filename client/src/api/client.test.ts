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

describe('api client account', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the picked account, and follows the one the server used', async () => {
    const stored = new Map([['currentAccount', 'PA2']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => void stored.set(k, v),
    });
    const fetch = vi.fn(
      async () => new Response('{}', { status: 200, headers: { 'X-Account-Id': 'PA1' } }),
    );
    vi.stubGlobal('fetch', fetch);
    await api.options();
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ 'X-Account-Id': 'PA2' });
    // PA2 was deleted: the server answered for PA1, so the app now shows PA1.
    expect(stored.get('currentAccount')).toBe('PA1');
  });
});
