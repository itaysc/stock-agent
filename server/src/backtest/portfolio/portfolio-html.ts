import { writeFile } from 'node:fs/promises';
import { DISCLAIMER } from '../backtest-report.js';
import { loadChartLibrary } from '../report/html-report.js';
import {
  BASE_STYLE,
  escapeHtml as e,
  jsonForScript,
  scriptSafe,
} from '../report/html-utils.js';
import {
  AI_SUMMARY_STYLE,
  renderAiSummaryHtml,
} from '../summary/ai-summary.format.js';
import type { AiSummary } from '../summary/ai-summary.types.js';
import { renderWalkForwardChart } from '../walkforward/html/walkforward-chart.js';
import type { PortfolioResult } from './portfolio.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const day = (d?: Date) => d?.toISOString().slice(0, 10) ?? 'n/a';
const tone = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n >= 0 ? 'gain' : 'loss';
const STYLE = `#wf-chart { height: 340px; } td.num, th.num { text-align: right; } .note { color: var(--muted); font-size: 13px; }`;

const tile = (label: string, value: string, sub: string, cls = '') =>
  `<div class="tile"><div class="label">${e(label)}</div><div class="value ${cls}">${e(value)}</div><div class="sub">${e(sub)}</div></div>`;

export function renderPortfolioHtml(
  r: PortfolioResult,
  summary: AiSummary | null,
  chartLibrary: string,
): string {
  const m = r.metrics;
  const tiles = [
    tile(
      'Return',
      pct(m.totalReturnPct),
      `benchmark ${pct(r.benchmarkReturnPct)}`,
      tone(m.totalReturnPct),
    ),
    tile('Final equity', money(r.finalEquity), `from ${money(r.initialCash)}`),
    tile(
      'Max drawdown',
      pct(-m.maxDrawdownPct),
      `benchmark ${pct(-r.benchmarkMaxDrawdownPct)}`,
    ),
    tile(
      'Closed trades',
      String(m.trades),
      `interest ${money(r.interestEarned)}`,
    ),
    tile(
      'Portfolio stop',
      r.risk.maxDrawdownPct ? `${r.stops.length}×` : 'off',
      r.risk.maxDrawdownPct
        ? `at -${r.risk.maxDrawdownPct}%, pause ${r.risk.cooldownDays}d`
        : '',
    ),
  ].join('');
  const sleeves = r.sleeves
    .map(
      (s, i) =>
        `<tr><td>${i + 1}</td><td>${e(s.label)}</td><td class="num">${money(s.allocated)}</td><td class="num ${tone(s.result.metrics.totalReturnPct)}">${pct(s.result.metrics.totalReturnPct)}</td><td class="num">${pct(s.holdReturnPct)}</td><td class="num">${pct(-s.result.metrics.maxDrawdownPct)}</td><td class="num">${s.result.metrics.trades}</td><td class="num ${tone(s.contribution)}">${money(s.contribution)}</td></tr>`,
    )
    .join('');
  const corr =
    r.sleeves.length > 1
      ? `<section><div class="head"><h2>How alike the sleeves move</h2></div><p class="note">Correlation of daily moves: 1 = the same, 0 = unrelated. Sleeves that move alike don't spread the risk.</p>
      <div class="table-wrap"><table><thead><tr><th></th>${r.sleeves.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}</tr></thead><tbody>
      ${r.correlation.map((row, i) => `<tr><td>${i + 1}</td>${row.map((c) => `<td class="num">${c === null ? 'n/a' : c.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`
      : '';
  const times = r.equityCurve.map((p) =>
    Math.floor(p.timestamp.getTime() / 1000),
  );
  const data = {
    times,
    equity: r.equityCurve.map((p) => p.equity),
    buyAndHold: r.benchmark,
    windowStarts: r.stops.map((s) => ({
      index: r.equityCurve.findIndex((p) => p.timestamp >= s.timestamp),
      label: 'stop',
    })),
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portfolio: ${r.sleeves.length} sleeves</title><style>${BASE_STYLE}${AI_SUMMARY_STYLE}${STYLE}</style></head>
<body><main>
  <h1>Portfolio: ${r.sleeves.length} sleeves</h1>
  <p class="meta">${day(r.from)} → ${day(r.to)} · benchmark = each sleeve's money bought and held in its own symbols${r.reserve.allocated > 0 ? `, ${money(r.reserve.allocated)} reserve in cash` : ''}</p>
  <div class="tiles">${tiles}</div>
  ${renderAiSummaryHtml(summary)}
  <section><div class="head"><h2>Portfolio vs benchmark</h2></div><p class="note">Dashed: the benchmark. "stop" marks the portfolio stop.</p><div id="wf-chart"></div></section>
  <section><div class="head"><h2>Sleeves</h2></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Sleeve</th><th class="num">Allocated</th><th class="num">Result</th><th class="num">Holding</th><th class="num">Max DD</th><th class="num">Trades</th><th class="num">Contribution</th></tr></thead><tbody>${sleeves}</tbody></table></div></section>
  ${corr}
  <footer>${e(DISCLAIMER)}</footer>
</main>
<script type="application/json" id="wf-data">${jsonForScript(data)}</script>
<script>${scriptSafe(chartLibrary)}</script>
<script>(${renderWalkForwardChart.toString()})(JSON.parse(document.getElementById('wf-data').textContent), window.LightweightCharts);</script>
</body></html>
`;
}

export async function writePortfolioHtml(
  path: string,
  r: PortfolioResult,
  summary: AiSummary | null,
): Promise<void> {
  await writeFile(
    path,
    renderPortfolioHtml(r, summary, await loadChartLibrary()),
  );
}
