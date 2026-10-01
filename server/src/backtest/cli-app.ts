import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

/**
 * Boots the minimal backtest app (config + Alpaca REST) for CLI commands.
 * The live WebSocket streams are switched off first: the config is validated
 * when the module loads, so the module is imported only after that.
 */
export async function createBacktestApp(): Promise<INestApplicationContext> {
  process.env.ALPACA_STREAMS_ENABLED = 'false';
  const { BacktestCliModule } = await import('./backtest-cli.module.js');
  return NestFactory.createApplicationContext(BacktestCliModule, {
    logger: ['warn', 'error'],
  });
}
