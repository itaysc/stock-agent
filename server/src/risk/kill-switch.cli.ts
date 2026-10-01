import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';

const USAGE = `Usage: npm run kill-switch -- <status|on|off> [options]

  status                  show whether the kill switch is engaged
  on --reason "<text>"    block all new orders and cancel open orders
     --flatten            also close every position (market orders)
  off                     allow trading again`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    reason: { type: 'string', default: 'engaged from CLI' },
    flatten: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
const command = positionals[0];

if (values.help || !['status', 'on', 'off'].includes(command ?? '')) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

// REST only: keep the WebSocket streams off. Set before the modules load.
process.env.ALPACA_STREAMS_ENABLED = 'false';
const { KillSwitchCliModule } = await import('./kill-switch-cli.module.js');
const { KillSwitchService } = await import('./kill-switch.service.js');

const app = await NestFactory.createApplicationContext(KillSwitchCliModule, {
  logger: ['warn', 'error'],
});
try {
  const killSwitch = app.get(KillSwitchService);
  if (command === 'on') {
    const result = await killSwitch.engage(values.reason, {
      flatten: values.flatten,
    });
    console.log(
      `Kill switch ENGAGED. Canceled ${result.canceledOrders} orders, closed ${result.closedPositions} positions.`,
    );
  } else if (command === 'off') {
    await killSwitch.release();
    console.log('Kill switch released. Trading is allowed again.');
  } else {
    const state = await killSwitch.state();
    console.log(
      state.engaged
        ? `ENGAGED since ${state.changedAt?.toISOString()}: ${state.reason}`
        : 'Not engaged: trading allowed.',
    );
  }
} catch (err) {
  console.error(`Kill switch command failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
