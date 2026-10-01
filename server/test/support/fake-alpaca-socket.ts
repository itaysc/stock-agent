import { Alpaca, type streaming } from '@alpacahq/alpaca-trade-api';
import { decode, encode } from '@msgpack/msgpack';
import type { ConfigService } from '@nestjs/config';
import { AlpacaStreamService } from '../../src/alpaca/alpaca-stream.service.js';
import type { Env } from '../../src/config/env.js';

/** In-memory socket speaking Alpaca's wire format (JSON for trading, msgpack for market data). */
export class FakeSocket implements streaming.WebSocketLike {
  readonly sent: Record<string, unknown>[] = [];
  private readonly listeners = new Map<
    string,
    ((...args: unknown[]) => void)[]
  >();

  constructor(
    readonly url: string,
    private readonly codec: streaming.Codec,
  ) {}

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  send(data: string | Uint8Array): void {
    this.sent.push(
      (this.codec === 'json'
        ? JSON.parse(data as string)
        : decode(data as Uint8Array)) as Record<string, unknown>,
    );
  }

  close(): void {
    this.emit('close');
  }

  open(): void {
    this.emit('open');
  }

  receive(message: unknown): void {
    this.emit(
      'message',
      this.codec === 'json' ? JSON.stringify(message) : encode(message),
    );
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

export function setup({ enabled = true, paper = true } = {}) {
  const sockets: FakeSocket[] = [];
  const config = {
    get: (key: keyof Env) =>
      ({ ALPACA_STREAMS_ENABLED: enabled, ALPACA_DATA_FEED: 'iex' })[
        key as string
      ],
  } as unknown as ConfigService<Env, true>;

  const service = new AlpacaStreamService(
    new Alpaca({ keyId: 'key', secret: 'secret', paper }),
    {
      pingIntervalMs: 0,
      wsFactory: (url, codec) => {
        const socket = new FakeSocket(url, codec);
        sockets.push(socket);
        return socket;
      },
    },
    config,
  );

  const socketFor = (host: string) => {
    const socket = sockets.find((s) => s.url.includes(host));
    if (!socket) throw new Error(`no socket for ${host}`);
    return socket;
  };

  return { service, sockets, socketFor };
}

export function connectTrading(socket: FakeSocket) {
  socket.open();
  socket.receive({ stream: 'authorization', data: { status: 'authorized' } });
}

export function connectMarketData(socket: FakeSocket) {
  socket.open();
  socket.receive([{ T: 'success', msg: 'authenticated' }]);
}

export const bar = (symbol: string, close: number) => ({
  T: 'b',
  S: symbol,
  o: 1,
  h: 2,
  l: 0.5,
  c: close,
  v: 100,
  t: '2026-09-25T14:30:00Z',
});
