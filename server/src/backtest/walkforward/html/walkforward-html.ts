import { writeFile } from 'node:fs/promises';
import { DISCLAIMER } from '../../backtest-report.js';
import { loadChartLibrary } from '../../report/html-report.js';
import {
  BASE_STYLE,
  escapeHtml,
  jsonForScript,
  scriptSafe,
} from '../../report/html-utils.js';
import {
  AI_SUMMARY_STYLE,
  renderAiSummaryHtml,
} from '../../summary/ai-summary.format.js';
import type { AiSummary } from '../../summary/ai-summary.types.js';
import { paramsText } from '../../sweep/sweep-report.js';
import { walkForwardSetup } from '../walkforward-report.js';
import type { WalkForwardResult } from '../walkforward.types.js';
import {
  renderWalkForwardChart,
  type WalkForwardChartData,
} from './walkforward-chart.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const day = (d: Date) => d.toISOString().slice(0, 10);
const tone = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n >= 0 ? 'gain' : 'loss';

const STYLE = `
#wf-chart { height: 360px; }
td.num, th.num { text-align: right; }
.note { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
`;

function tile(label: string, value: string, sub: string, cls = ''): string {
  return `<div class="tile"><div class="label">${escapeHtml(label)}</div><div class="value ${cls}">${escapeHtml(value)}</div><div class="sub">${escapeHtml(sub)}</div></div>`;
}

export function chartData(r: WalkForwardResult): WalkForwardChartData {
  const times = r.equityCurve.map((p) =>
    Math.floor(p.timestamp.getTime() / 1000),
  );
  const windowStarts = r.windows
    .map((w) => ({
      index: r.equityCurve.findIndex((p) => p.timestamp >= w.testFrom),
      label: `W${w.index}`,
    }))
    .filter((w) => w.index >= 0);
  return {
    times,
    equity: r.equityCurve.map((p) => p.equity),
    buyAndHold: r.buyAndHold,
    windowStarts,
  };
}

export function renderWalkForwardHtml(
  r: WalkForwardResult,
  summary: AiSummary | null,
  chartLibrary: string,
): string {
  const m = r.metrics;
  const title = `Walk-forward: ${r.strategies.join(' vs ')} on ${r.symbols.join(', ')}`;
  const efficiency =
    r.efficiencyPct === null ? 'n/a' : `${r.efficiencyPct.toFixed(0)}%`;
  const tiles = [
    tile(
      'Return on unseen data',
      pct(m.totalReturnPct),
      `Buy & hold ${pct(m.buyAndHoldReturnPct)}`,
      tone(m.totalReturnPct),
    ),
    tile(
      'Annualized',
      pct(r.outOfSampleAnnualPct),
      `vs ${pct(r.inSampleAnnualPct)} in training`,
      tone(r.outOfSampleAnnualPct),
    ),
    tile('Efficiency', efficiency, 'unseen ÷ training; ~50%+ is decent'),
    tile(
      'Max drawdown',
      pct(-m.maxDrawdownPct),
      'on unseen data',
      m.maxDrawdownPct > 0 ? 'loss' : '',
    ),
    tile(
      'Closed trades',
      String(m.trades),
      `win rate ${pct(m.winRatePct).replace('+', '')}`,
    ),
    tile(
      'Settings',
      `${r.distinctSettings} used`,
      `changed ${r.paramChanges}× in ${r.windows.length} windows`,
    ),
  ].join('');
  const rows = r.windows
    .map((w) => {
      const chosen = w.chosen
        ? `${w.chosen.strategy} ${paramsText(w.chosen.params)}`
        : '(no valid setting)';
      return `<tr><td>W${w.index}</td><td>${day(w.trainFrom)} → ${day(w.trainTo)}</td><td>${escapeHtml(chosen)}</td>
        <td class="num ${tone(w.chosen?.trainReturnPct)}">${pct(w.chosen?.trainReturnPct)}</td>
        <td>${day(w.testFrom)} → ${day(w.testTo)}</td><td class="num ${tone(w.test?.returnPct)}">${pct(w.test?.returnPct)}</td>
        <td class="num">${pct(w.test?.buyAndHoldReturnPct)}</td><td class="num">${w.test?.trades ?? ''}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${BASE_STYLE}${AI_SUMMARY_STYLE}${STYLE}</style></head>
<body><main>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(`${walkForwardSetup(r)} · unseen data ${day(r.oosFrom)} → ${day(r.oosTo)} · ${money(r.initialCash)} → ${money(r.finalEquity)}`)}</p>
  <div class="tiles">${tiles}</div>
  ${renderAiSummaryHtml(summary)}
  <section><div class="head"><h2>Equity on unseen data</h2></div>
    <p class="note">Only the test periods, stitched together: each starts with the money the previous one ended with. W1, W2, … mark where each test window begins. Dashed: buy &amp; hold.</p>
    <div id="wf-chart"></div></section>
  <section><div class="head"><h2>Windows</h2></div>
    <p class="note">Each row: the best setting on the training period, then how that setting did on the next, unseen period.</p>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Training</th><th>Chosen setting</th><th class="num">Train</th>
      <th>Test (unseen)</th><th class="num">Test</th><th class="num">Buy &amp; hold</th><th class="num">Trades</th></tr></thead>
      <tbody>${rows}</tbody></table></div></section>
  <footer>${escapeHtml(DISCLAIMER)}</footer>
</main>
<script type="application/json" id="wf-data">${jsonForScript(chartData(r))}</script>
<script>${scriptSafe(chartLibrary)}</script>
<script>(${renderWalkForwardChart.toString()})(JSON.parse(document.getElementById('wf-data').textContent), window.LightweightCharts);</script>
</body></html>
`;
}

export async function writeWalkForwardHtml(
  path: string,
  r: WalkForwardResult,
  summary: AiSummary | null,
): Promise<void> {
  await writeFile(
    path,
    renderWalkForwardHtml(r, summary, await loadChartLibrary()),
  );
}
