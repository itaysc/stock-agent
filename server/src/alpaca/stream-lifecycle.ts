import { streaming } from '@alpacahq/alpaca-trade-api';
import type { Logger } from '@nestjs/common';

/** Logs a stream's connect, reconnect and error events. */
export function logStreamLifecycle(
  stream: streaming.AlpacaWebSocket,
  name: string,
  logger: Logger,
): void {
  stream.onError((message) => {
    const hint = message.includes('connection limit')
      ? ' (Alpaca allows one market data connection per account; is another instance running?)'
      : '';
    logger.error(`${name} stream error: ${message}${hint}`);
  });
  stream.onReconnecting((attempt) =>
    logger.warn(`${name} stream reconnecting (attempt ${attempt})`),
  );
  stream.onReconnected(() => logger.log(`${name} stream reconnected`));
  void stream.whenAuthenticated().then((result) => {
    if (result.authenticated) {
      logger.log(`${name} stream connected`);
    } else if (result.status === streaming.STREAM_AUTH_STATUS.SERVER_REJECTED) {
      // Terminal: the SDK does not reconnect with rejected credentials.
      logger.error(`${name} stream authentication rejected: ${result.message}`);
    }
  });
}
