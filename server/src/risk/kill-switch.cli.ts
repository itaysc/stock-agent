import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';

const USAGE = `Usage: npm run kill-switch -- <status|on|off> [options]

  status                  show whether the kill switch is engaged
  on --reason "<text>"    block all new orders and cancel open orders
     --flatten            also close every position (market orders)
  off                     allow trading again

  Every account, or only one with --account <account number>.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    reason: { type: 'string', default: 'engaged from CLI' },
    flatten: { type: 'boolean', default: false },
    account: { type: 'string' },
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
const { AlpacaAccounts } =
  await import('../accounts/alpaca-accounts.service.js');
const { AccountContext } = await import('../accounts/account-context.js');

const app = await NestFactory.createApplicationContext(KillSwitchCliModule, {
  logger: ['warn', 'error'],
});
try {
  const killSwitch = app.get(KillSwitchService);
  const accounts = app
    .get(AlpacaAccounts)
    .list()
    .filter((a) => !values.account || a.id === values.account);
  if (!accounts.length) throw new Error('No such Alpaca account');
  for (const account of accounts) {
    const name = `${account.name} (${account.id})`;
    await AccountContext.run(account, async () => {
      if (command === 'on') {
        const result = await killSwitch.engage(values.reason, {
          flatten: values.flatten,
        });
        console.log(
          `${name}: kill switch ENGAGED. Canceled ${result.canceledOrders} orders, closed ${result.closedPositions} positions.`,
        );
      } else if (command === 'off') {
        await killSwitch.release();
        console.log(`${name}: kill switch released. Trading is allowed again.`);
      } else {
        const state = await killSwitch.state();
        console.log(
          state.engaged
            ? `${name}: ENGAGED since ${state.changedAt?.toISOString()}: ${state.reason}`
            : `${name}: not engaged, trading allowed.`,
        );
      }
    });
  }
} catch (err) {
  console.error(`Kill switch command failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
