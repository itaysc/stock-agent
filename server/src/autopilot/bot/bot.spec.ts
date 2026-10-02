import type { TelegramClient } from '../../notify/telegram.client.js';
import type { DeploymentsService } from '../../paper/deployments.service.js';
import type { AutopilotService } from '../autopilot.service.js';
import type { IdeasService } from '../ideas/ideas.service.js';
import { BotCommands, parseAmount } from './bot-commands.js';
import type { BrokerCommands } from './broker-commands.js';
import { TelegramBotService } from './telegram-bot.service.js';

function setup(running: object | null = null) {
  const ideas = {
    invest: vi.fn(
      async (id: string, amount?: number) => `invest ${id} ${amount}`,
    ),
    skip: vi.fn(async (id: string) => `skip ${id}`),
    pending: vi.fn(async () => []),
    answerable: vi.fn(async (id: string) =>
      id === 'gone'
        ? 'Idea gone is already skipped.'
        : { id, label: 'SPY', capital: 10_000 },
    ),
  };
  const autopilot = { running, start: vi.fn() };
  const commands = new BotCommands(
    ideas as unknown as IdeasService,
    autopilot as unknown as AutopilotService,
    {
      list: async () => [],
      freeCash: async () => 12_000.7,
    } as unknown as DeploymentsService,
    {
      handle: async (command: string) =>
        command === 'pause' ? 'paused' : null,
      status: async () => 'Broker: not running.',
      button: async (data: string) =>
        data.startsWith('dd') ? 'drawdown answer' : null,
    } as unknown as BrokerCommands,
  );
  return { commands, ideas, autopilot };
}

describe('BotCommands', () => {
  it('reads amounts', () => {
    expect(parseAmount('5000')).toBe(5_000);
    expect(parseAmount('$5,000')).toBe(5_000);
    expect(parseAmount('5k')).toBe(5_000);
    expect(parseAmount(undefined)).toBeUndefined();
    expect(parseAmount('lots')).toBeNaN();
  });

  it('answers invest / skip, with or without the slash or @botname', async () => {
    const { commands, ideas } = setup();
    expect(await commands.text('/invest k3f9 5k')).toBe('invest k3f9 5000');
    expect(await commands.text('invest@MyBot k3f9 2000')).toBe(
      'invest k3f9 2000',
    );
    expect(await commands.text('/invest k3f9 lots')).toMatch(/not an amount/);
    expect(await commands.button('skip:k3f9')).toBe('skip k3f9');
    expect(ideas.invest).toHaveBeenCalledTimes(2);
    expect(await commands.text('/pause')).toBe('paused'); // the broker's
    expect(await commands.button('ddkeep:d1')).toBe('drawdown answer');
    expect(await commands.text('/status')).toMatch(/^Broker: not running\./);
    expect(await commands.text('/hello')).toMatch(/I don't know "\/hello"/);
  });

  it('asks how much, with amounts that fit the free cash, then takes a tap or a typed amount', async () => {
    const { commands, ideas } = setup();
    const now = Date.now();
    expect(await commands.button('invest:k3f9', now)).toEqual({
      text: 'How much paper money for SPY? Free to invest: $12,000.\nTap an amount, or type one (e.g. 7500).',
      buttons: [
        { text: '$1,000', data: 'amount:k3f9:1000' },
        { text: '$5,000', data: 'amount:k3f9:5000' },
        { text: '$10,000', data: 'amount:k3f9:10000' },
      ],
    });
    expect(await commands.button('amount:k3f9:5000')).toBe('invest k3f9 5000');
    expect(await commands.text('7500', now)).toMatch(/Which idea is that for/); // answered already
    await commands.text('invest@MyBot k3f9', now); // asks again
    expect(await commands.text('$7,500', now)).toBe('invest k3f9 7500');
    await commands.text('/invest k3f9', now);
    expect(await commands.text('7500', now + 16 * 60_000)).toMatch(
      /Which idea/,
    ); // too late
    expect(ideas.invest).toHaveBeenCalledTimes(2);
    expect(await commands.button('invest:gone')).toBe(
      'Idea gone is already skipped.',
    );
  });

  it('starts research for /check, unless a run is going', async () => {
    const { commands, autopilot } = setup();
    expect(await commands.text('/check spy qqq')).toMatch(
      /Researching SPY \+ QQQ/,
    );
    expect(autopilot.start).toHaveBeenCalledWith('chat', [
      { label: 'SPY + QQQ', symbols: ['SPY', 'QQQ'] },
    ]);
    expect(await commands.text('/check $$$')).toMatch(/Not a symbol/);
    const busy = setup({ startedAt: new Date() });
    expect(await busy.commands.text('/run')).toMatch(/^Busy/);
    expect(busy.autopilot.start).not.toHaveBeenCalled();
  });
});

describe('TelegramBotService', () => {
  const make = () => {
    const telegram = {
      chatId: '42',
      configured: true,
      send: vi.fn(async () => undefined),
      call: vi.fn(async () => true),
    };
    const commands = {
      text: vi.fn(async () => 'reply'),
      button: vi.fn(async () => 'pressed'),
    };
    const bot = new TelegramBotService(
      { get: () => true } as never,
      telegram as unknown as TelegramClient,
      commands as unknown as BotCommands,
    );
    return { bot, telegram, commands };
  };
  const now = Date.now();
  const msg = (chat: number, text: string, ageS = 0) => ({
    update_id: 1,
    message: { chat: { id: chat }, date: now / 1000 - ageS, text },
  });

  it('answers only your chat, and skips old messages', async () => {
    const { bot, telegram, commands } = make();
    await bot.handle(msg(42, '/status'), now);
    expect(telegram.send).toHaveBeenCalledWith('reply');
    await bot.handle(msg(7, '/invest k3f9'), now); // a stranger
    await bot.handle(msg(42, '/run', 3600), now); // sent while the server was down
    expect(commands.text).toHaveBeenCalledTimes(1);
  });

  it('handles a button once: answers it, removes the buttons, replies', async () => {
    const { bot, telegram, commands } = make();
    await bot.handle(
      {
        update_id: 2,
        callback_query: {
          id: 'q1',
          data: 'invest:k3f9',
          message: { chat: { id: 42 }, message_id: 9 },
        },
      },
      now,
    );
    expect(commands.button).toHaveBeenCalledWith('invest:k3f9');
    expect(telegram.call.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      'answerCallbackQuery',
      'editMessageReplyMarkup',
    ]);
    expect(telegram.send).toHaveBeenCalledWith('pressed');
    await bot.handle(
      {
        update_id: 3,
        callback_query: {
          id: 'q2',
          data: 'invest:k3f9',
          message: { chat: { id: 7 }, message_id: 9 },
        },
      },
      now,
    );
    expect(commands.button).toHaveBeenCalledTimes(1);
  });
});
