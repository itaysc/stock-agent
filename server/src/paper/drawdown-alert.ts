import { type CycleDeps, logEvent } from './deployment-events.js';
import { deploymentEquity } from './deployment-cycle.js';
import type { Deployment } from './deployment.types.js';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * The drawdown alert: once the deployment is `pct` below its peak, it asks
 * you in Telegram (sell everything, or keep going) instead of selling by
 * itself; again every 10% deeper; and re-arms after it recovers halfway.
 */
export async function drawdownAlert(
  d: Deployment,
  deps: CycleDeps,
  now: Date,
): Promise<void> {
  const alert = d.drawdownAlert;
  if (!alert || d.status !== 'active' || !(d.peakEquity > 0)) return;
  const equity = deploymentEquity(d);
  const drawdown = ((d.peakEquity - equity) / d.peakEquity) * 100;
  if (drawdown < alert.pct / 2) {
    alert.alertedAtPct = null; // recovered: the next fall is a new alert
    return;
  }
  if (
    drawdown < alert.pct ||
    (alert.alertedAtPct !== null && drawdown < alert.alertedAtPct + 10)
  )
    return;
  alert.alertedAtPct = Math.floor(drawdown);
  const text = [
    `⚠️ ${d.name} is down ${drawdown.toFixed(1)}% from its peak (${money(d.peakEquity)} → ${money(equity)}).`,
    'It keeps following its rules unless you say otherwise. Falls like this happened before (see its worst drop) and it recovered, but not always quickly.',
    'Sell everything and stop, or keep going?',
  ].join('\n');
  logEvent(
    d,
    `Drawdown alert: ${drawdown.toFixed(1)}% below its peak; asked you in Telegram`,
    now,
  );
  await deps.notify(text, [
    { text: '🔴 Sell all & stop', data: `ddsell:${d.id}` },
    { text: '🟢 Keep going', data: `ddkeep:${d.id}` },
  ]);
}
