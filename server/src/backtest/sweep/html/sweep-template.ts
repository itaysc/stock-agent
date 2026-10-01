import { DISCLAIMER } from '../../backtest-report.js';
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
import { renderSweep } from './sweep-client.js';
import { strategyChartSvg, variedParams } from './sweep-heatmap-svg.js';
import type { SweepHtmlData } from './sweep-html-data.js';
import { scatterSvg } from './sweep-scatter-svg.js';

const SWEEP_STYLE = `
:root { --s1: #2f6fde; --s2: #d97706; --s3: #7c3aed; --s4: #0d9488;
  --c1: #2f6fde; --c2: #d97706; --c3: #7c3aed; --c4: #0d9488; --c5: #db2777; }
@media (prefers-color-scheme: dark) {
  :root { --s1: #6ea0ff; --s2: #f5a524; --s3: #a78bfa; --s4: #2dd4bf;
    --c1: #6ea0ff; --c2: #f5a524; --c3: #a78bfa; --c4: #2dd4bf; --c5: #f472b6; }
}
svg { width: 100%; height: auto; display: block; }
svg text { font-family: var(--font); fill: var(--text); }
.tick { font-size: 11px; fill: var(--muted); }
.axis-title { font-size: 12px; fill: var(--muted); }
.cell-text { font-size: 11px; font-variant-numeric: tabular-nums; pointer-events: none; }
.muted-fill { fill: var(--muted); }
.cell, .dot { cursor: pointer; }
.cell.beat rect { stroke: var(--text); stroke-width: 1.5; }
.cell.selected rect { stroke: var(--accent); stroke-width: 3; }
.empty { fill: none; stroke: var(--border); stroke-dasharray: 3 3; }
.grid { stroke: var(--grid); }
.zero { stroke: var(--border); stroke-width: 1.5; }
.hold { stroke: var(--muted); stroke-dasharray: 5 4; }
.hold-label { font-size: 11px; fill: var(--muted); }
.dot { stroke: var(--surface); stroke-width: 1.5; fill-opacity: 0.85; }
.dot.selected { stroke: var(--text); stroke-width: 3; }
.note { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
.legend-list { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.key::before { content: ''; display: inline-block; width: 14px; border-top: 2px solid var(--key, var(--muted)); vertical-align: middle; margin-right: 6px; }
.hold-key::before { border-top-style: dashed; }
th.sortable { cursor: pointer; user-select: none; }
tr[data-id] { cursor: pointer; }
tr.selected td { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.command-box { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.command-box code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 8px 10px;
  border: 1px solid var(--border); border-radius: 8px; font-size: 12px; background: var(--bg); }
.command-box button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; }
#curves-chart { height: 320px; }
`;

const pct = (n: number | null) =>
  n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

export function renderSweepHtml(
  data: SweepHtmlData,
  chartLibrary: string,
): string {
  const strategies = data.summaries.map((s) => s.strategy);
  const title = `Sweep: ${strategies.join(' vs ')} on ${data.symbols.join(', ')}`;
  const period = `${data.from?.slice(0, 10) ?? 'n/a'} → ${data.to?.slice(0, 10) ?? 'n/a'}`;
  const tiles = data.summaries
    .map((s) => {
      const tone = (s.medianReturnPct ?? 0) >= 0 ? 'gain' : 'loss';
      return `<div class="tile"><div class="label">${escapeHtml(s.strategy)}</div>
        <div class="value ${tone}">${pct(s.medianReturnPct)}</div>
        <div class="sub">median of ${s.runs} runs · best ${pct(s.bestReturnPct)}</div>
        <div class="sub">${s.positive}/${s.runs} positive · ${s.beatHold}/${s.runs} beat buy &amp; hold</div></div>`;
    })
    .join('');
  const charts = strategies
    .map((strategy) => {
      const own = data.runs.filter((r) => r.strategy === strategy);
      const svg = strategyChartSvg(own);
      const varied = variedParams(own);
      const head = `<section><div class="head"><h2>${escapeHtml(strategy)}: return by setting</h2></div>`;
      if (svg) {
        return `${head}<p class="note">Each cell is one setting. Greener is better; outlined cells beat buy &amp; hold. A block of good neighbors is more trustworthy than one lone winner.</p>${svg}</section>`;
      }
      return varied.length > 2
        ? `${head}<p class="note">The heatmap shows up to 2 swept params; this sweep varies ${varied.length} (${escapeHtml(varied.join(', '))}). Use the scatter and table below, or sweep fewer params at a time.</p></section>`
        : '';
    })
    .join('');
  const legend =
    strategies.length > 1
      ? `<div class="legend-list">${strategies.map((s, i) => `<span class="key" style="--key: var(--s${(i % 4) + 1})">${escapeHtml(s)}</span>`).join('')}</div>`
      : '';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${BASE_STYLE}${SWEEP_STYLE}${AI_SUMMARY_STYLE}</style></head>
<body><main>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(`${period} · ${data.bars} bars · ${data.timeframe} · ${data.runs.length} runs · buy & hold ${pct(data.buyAndHoldReturnPct)}${data.skipped ? ` · ${data.skipped} invalid combinations skipped` : ''}`)}</p>
  <div class="tiles">${tiles}</div>
  ${renderAiSummaryHtml(data.aiSummary)}
  ${charts}
  <section><div class="head"><h2>Return vs. drawdown</h2></div>
    <p class="note">Each dot is one run. Up and to the left is better: more return for a smaller worst fall.</p>${legend}
    ${scatterSvg(data.runs, data.buyAndHoldReturnPct, strategies)}</section>
  <section><div class="head"><h2>Top ${data.curves.top.length} equity curves (by ${escapeHtml(data.sort)})</h2></div>
    <div class="legend-list" id="curves-legend"></div><div id="curves-chart"></div></section>
  <section><div class="head"><h2>All runs</h2></div>
    <p class="note">Click a column to sort. Click a row, cell or dot to get the command for its full report.</p>
    <div class="table-wrap"><table id="runs"></table></div>
    <div class="command-box"><span class="muted" id="selected-label"></span></div>
    <div class="command-box"><code id="command"></code><button id="copy" type="button">Copy</button></div>
  </section>
  <footer>${escapeHtml(DISCLAIMER)}</footer>
</main>
<script type="application/json" id="sweep-data">${jsonForScript(data)}</script>
<script>${scriptSafe(chartLibrary)}</script>
<script>(${renderSweep.toString()})(JSON.parse(document.getElementById('sweep-data').textContent), window.LightweightCharts);</script>
</body></html>
`;
}
