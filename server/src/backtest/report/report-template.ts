import { DISCLAIMER } from '../backtest-report.js';
import {
  AI_SUMMARY_STYLE,
  renderAiSummaryHtml,
} from '../summary/ai-summary.format.js';
import { renderCharts } from './report-charts.js';
import { reportHelpers } from './report-helpers.js';
import { renderFills, renderTiles } from './report-tables.js';
import type { ReportData } from './report-data.js';
import {
  BASE_STYLE,
  escapeHtml,
  jsonForScript,
  scriptSafe,
} from './html-utils.js';

export function renderHtml(data: ReportData, chartLibrary: string): string {
  const title = `${data.strategy} on ${data.symbols.join(', ')}`;
  const period = `${data.from?.slice(0, 10) ?? 'n/a'} → ${data.to?.slice(0, 10) ?? 'n/a'}`;
  const settings = Object.entries(data.settings)
    .map(([k, val]) => `${k} ${val}`)
    .join(' · ');
  const open = data.openPositions.length
    ? ` · still open: ${data.openPositions.map((p) => `${p.qty} ${p.symbol}`).join(', ')}`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Backtest: ${escapeHtml(title)}</title>
<style>${BASE_STYLE}${AI_SUMMARY_STYLE}</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(`${period} · ${data.bars} bars${settings ? ` · ${settings}` : ''}${open}`)}</p>
  <div class="tiles" id="tiles"></div>
  ${renderAiSummaryHtml(data.aiSummary)}
  <section>
    <div class="head"><h2>Equity</h2>
      <div class="legend"><span><i></i>Strategy</span><span><i class="dashed"></i>Buy &amp; hold</span></div>
    </div>
    <div class="chart" id="equity-chart"></div>
  </section>
  <section>
    <div class="head"><h2>Drawdown from peak</h2></div>
    <div class="chart" id="drawdown-chart"></div>
  </section>
  <section>
    <div class="head"><h2>Price and trades</h2><div class="tabs" id="tabs"></div></div>
    <div class="chart" id="price-chart"></div>
  </section>
  <section>
    <div class="head"><h2>Fills</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th class="num">Qty</th>
          <th class="num">Price</th><th class="num">P&amp;L</th><th>Reason</th></tr></thead>
        <tbody id="fills"></tbody>
      </table>
      <p class="muted" id="fills-empty" hidden>No trades in this period.</p>
    </div>
  </section>
  <footer>${escapeHtml(DISCLAIMER)}</footer>
</main>
<script type="application/json" id="report-data">${jsonForScript(data)}</script>
<script>${scriptSafe(chartLibrary)}</script>
<script>
const data = JSON.parse(document.getElementById('report-data').textContent);
const h = (${reportHelpers.toString()})(data);
(${renderTiles.toString()})(data, h);
(${renderCharts.toString()})(data, window.LightweightCharts, h);
(${renderFills.toString()})(data, h);
</script>
</body>
</html>
`;
}
