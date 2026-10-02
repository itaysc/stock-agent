import type { CycleDeps } from './deployment-events.js';
import type { Deployment } from './deployment.types.js';
import { drawdownAlert } from './drawdown-alert.js';
import { emptyLedger } from './sleeve-ledger.js';

const deployment = (cash: number): Deployment =>
  ({
    id: 'd1',
    name: 'Broker',
    status: 'active',
    capital: 1_000,
    peakEquity: 1_000,
    sleeves: [{ weightPct: 100 }],
    ledgers: [emptyLedger(cash)],
    events: [],
    drawdownAlert: { pct: 25, alertedAtPct: null },
  }) as unknown as Deployment;

describe('drawdown alert', () => {
  it('asks once past the level, again 10% deeper, never sells by itself, and re-arms after a recovery', async () => {
    const notify = vi.fn(async () => undefined);
    const deps = { notify } as unknown as CycleDeps;
    const d = deployment(800); // -20%: under the level
    await drawdownAlert(d, deps, new Date());
    expect(notify).not.toHaveBeenCalled();
    d.ledgers[0].cash = 740; // -26%
    await drawdownAlert(d, deps, new Date());
    await drawdownAlert(d, deps, new Date()); // same level: once
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]).toEqual([
      expect.stringMatching(
        /^⚠️ Broker is down 26.0% from its peak \(\$1,000 → \$740\)/,
      ),
      [
        { text: '🔴 Sell all & stop', data: 'ddsell:d1' },
        { text: '🟢 Keep going', data: 'ddkeep:d1' },
      ],
    ]);
    expect(d.status).toBe('active'); // it did not sell
    d.ledgers[0].cash = 630; // -37%: 10% deeper than the last alert
    await drawdownAlert(d, deps, new Date());
    expect(notify).toHaveBeenCalledTimes(2);
    d.ledgers[0].cash = 900; // back to -10%: re-armed
    await drawdownAlert(d, deps, new Date());
    expect(d.drawdownAlert?.alertedAtPct).toBeNull();
  });
});
