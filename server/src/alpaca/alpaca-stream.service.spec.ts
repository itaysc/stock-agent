import type { streaming } from '@alpacahq/alpaca-trade-api';
import {
  bar,
  connectMarketData,
  connectTrading,
  setup,
} from '../../test/support/fake-alpaca-socket.js';

describe('AlpacaStreamService', () => {
  describe('trade updates', () => {
    it('connects at startup and emits order events', () => {
      const { service, socketFor } = setup();
      const updates: streaming.TradeUpdate[] = [];
      service.tradeUpdates$.subscribe((u) => updates.push(u));

      service.onApplicationBootstrap();
      const socket = socketFor('paper-api.alpaca.markets');
      connectTrading(socket);

      expect(socket.sent).toEqual([
        {
          action: 'authenticate',
          data: { key_id: 'key', secret_key: 'secret' },
        },
        { action: 'listen', data: { streams: ['trade_updates'] } },
      ]);
      expect(service.status()).toEqual({
        trading: 'authenticated',
        marketData: 'idle',
      });

      socket.receive({
        stream: 'trade_updates',
        data: {
          event: 'fill',
          price: '190.5',
          order: { id: 'ord-1', symbol: 'AAPL', status: 'filled' },
        },
      });

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        event: 'fill',
        price: '190.5',
        order: { id: 'ord-1', symbol: 'AAPL' },
      });
    });

    it('uses the live endpoint when ALPACA_PAPER=false', () => {
      const { service, sockets } = setup({ paper: false });
      service.onApplicationBootstrap();
      expect(sockets[0].url).toBe('wss://api.alpaca.markets/stream');
    });
  });

  describe('market data', () => {
    it('opens the socket on first use and subscribes after auth', () => {
      const { service, sockets, socketFor } = setup();
      service.onApplicationBootstrap();
      expect(sockets).toHaveLength(1); // trading only

      const received: streaming.StreamBar[] = [];
      service.bars(['aapl']).subscribe((b) => received.push(b));

      const socket = socketFor('stream.data.alpaca.markets/v2/iex');
      connectMarketData(socket);
      expect(socket.sent).toContainEqual({
        action: 'subscribe',
        bars: ['AAPL'],
      });

      socket.receive([bar('AAPL', 191), bar('MSFT', 420)]);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ symbol: 'AAPL', close: 191 });
    });

    it('keeps a symbol subscribed until its last observer leaves', () => {
      const { service, socketFor } = setup();
      const first = service.bars(['AAPL']).subscribe();
      const second = service.bars(['AAPL', 'MSFT']).subscribe();

      const socket = socketFor('stream.data');
      connectMarketData(socket);
      socket.sent.length = 0;

      first.unsubscribe();
      expect(socket.sent).toEqual([]);

      second.unsubscribe();
      expect(socket.sent).toEqual([
        { action: 'unsubscribe', bars: ['AAPL', 'MSFT'] },
      ]);
    });

    it('rejects an empty symbol list', () => {
      const { service } = setup();
      const error = vi.fn();
      service.quotes([' ']).subscribe({ error });
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No symbols given for quotes stream',
        }),
      );
    });
  });

  it('does nothing when streams are disabled', () => {
    const { service, sockets } = setup({ enabled: false });
    service.onApplicationBootstrap();

    const error = vi.fn();
    service.bars(['AAPL']).subscribe({ error });

    expect(sockets).toHaveLength(0);
    expect(error).toHaveBeenCalled();
    expect(service.status()).toEqual({
      trading: 'disabled',
      marketData: 'disabled',
    });
  });

  it('disconnects and completes observers on shutdown', () => {
    const { service, socketFor } = setup();
    const complete = vi.fn();
    service.tradeUpdates$.subscribe({ complete });
    service.bars(['AAPL']).subscribe({ complete });

    service.onApplicationBootstrap();
    connectTrading(socketFor('paper-api'));
    service.onApplicationShutdown();

    expect(complete).toHaveBeenCalledTimes(2);
    expect(service.status()).toEqual({
      trading: 'disconnected',
      marketData: 'disconnected',
    });
  });
});
