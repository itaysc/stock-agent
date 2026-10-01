import { NotifierService } from './notifier.service.js';
import { TelegramClient } from './telegram.client.js';

const service = (env: Record<string, string>) => {
  const config = { get: (key: string) => env[key] ?? '' } as never;
  return new NotifierService(config, new TelegramClient(config));
};

describe('NotifierService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends to Telegram and the webhook when both are set', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);
    const n = service({
      TELEGRAM_BOT_TOKEN: '123:abc',
      TELEGRAM_CHAT_ID: '42',
      NOTIFY_WEBHOOK_URL: 'https://hooks.example.com/x',
    });
    expect(n.channels()).toEqual(['telegram', 'webhook']);
    await n.send('hello');
    const calls = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    expect(calls.map(([url]) => url)).toEqual([
      'https://api.telegram.org/bot123:abc/sendMessage',
      'https://hooks.example.com/x',
    ]);
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      chat_id: '42',
      text: 'hello',
      disable_web_page_preview: true,
    });
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ text: 'hello' });
  });

  it('adds buttons under a Telegram message', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);
    await service({ TELEGRAM_BOT_TOKEN: '1:a', TELEGRAM_CHAT_ID: '2' }).send(
      'idea',
      [{ text: 'Invest', data: 'invest:ab12' }],
    );
    const calls = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    expect(JSON.parse(calls[0][1].body as string).reply_markup).toEqual({
      inline_keyboard: [[{ text: 'Invest', callback_data: 'invest:ab12' }]],
    });
  });

  it('needs both Telegram settings, and never throws', async () => {
    expect(service({ TELEGRAM_BOT_TOKEN: '123:abc' }).configured).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{"description":"chat not found"}', { status: 400 }),
      ),
    );
    await expect(
      service({ TELEGRAM_BOT_TOKEN: '1:a', TELEGRAM_CHAT_ID: '2' }).send('x'),
    ).resolves.toBeUndefined();
  });
});
