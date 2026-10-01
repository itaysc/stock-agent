import { writeFile } from 'node:fs/promises';
import { DISCLAIMER } from '../../backtest/backtest-report.js';
import { planLabel } from '../../backtest/plans/plan-menu.js';
import { loadChartLibrary } from '../../backtest/report/html-report.js';
import {
  BASE_STYLE,
  escapeHtml,
  jsonForScript,
  scriptSafe,
} from '../../backtest/report/html-utils.js';
import {
  AI_SUMMARY_STYLE,
  renderAiSummaryHtml,
} from '../../backtest/summary/ai-summary.format.js';
import { renderWalkForwardChart } from '../../backtest/walkforward/html/walkforward-chart.js';
import { chartData } from '../../backtest/walkforward/html/walkforward-html.js';
import type { WalkForwardResult } from '../../backtest/walkforward/walkforward.types.js';
import { GOAL_TEXT } from '../research-score.js';
import type {
  Experiment,
  Outcome,
  ResearchSession,
} from '../research.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const tone = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n >= 0 ? 'gain' : 'loss';
const e = escapeHtml;
const params = (p: Record<string, string>) =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');

const STYLE = `
#wf-chart { height: 320px; }
td.num, th.num { text-align: right; }
.note { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
.round p { margin: 0 0 8px; }
.round ul { margin: 0 0 8px; padding-left: 20px; color: var(--muted); font-size: 13px; }
tr.champion td { background: color-mix(in srgb, var(--accent) 12%, transparent); font-weight: 600; }
.champion-card code { overflow-wrap: anywhere; }
`;

function tile(label: string, value: string, sub: string, cls = ''): string {
  return `<div class="tile"><div class="label">${e(label)}</div><div class="value ${cls}">${e(value)}</div><div class="sub">${e(sub)}</div></div>`;
}

function holdoutTiles(
  o: Outcome,
  score: number,
  research?: Experiment,
): string {
  return [
    tile(
      'Holdout return',
      pct(o.returnPct),
      `buy & hold ${pct(o.holdReturnPct)}`,
      tone(o.returnPct),
    ),
    tile(
      'Holdout annualized',
      pct(o.annualPct),
      `research ${pct(research?.outcome?.annualPct)}`,
      tone(o.annualPct),
    ),
    tile(
      'Holdout score',
      score.toFixed(2),
      `research ${research?.score?.toFixed(2) ?? 'n/a'}`,
      tone(score),
    ),
    tile(
      'Max drawdown',
      pct(-o.maxDrawdownPct),
      `buy & hold ${pct(-o.holdMaxDrawdownPct)}`,
    ),
    tile(
      'Closed trades',
      String(o.trades),
      `win rate ${pct(o.winRatePct).replace('+', '')}`,
    ),
    tile(
      'Latest pick',
      o.latestPick ? params(o.latestPick.params) || 'defaults' : 'none',
      o.latestPick?.strategy ?? '',
    ),
  ].join('');
}

function experimentRow(x: Experiment, championId: number | null): string {
  const o = x.outcome;
  const cls = x.id === championId ? ' class="champion"' : '';
  if (!o) {
    return `<tr${cls}><td>#${x.id}</td><td>${e(planLabel(x.plan))}</td><td colspan="6" class="loss">${e(x.error ?? 'not run')}</td></tr>`;
  }
  return `<tr${cls}><td>#${x.id}</td><td>${e(planLabel(x.plan))}${x.plan.why ? `<div class="sub">${e(x.plan.why)}</div>` : ''}</td>
    <td class="num ${tone(o.returnPct)}">${pct(o.returnPct)}</td><td class="num">${pct(o.holdReturnPct)}</td>
    <td class="num">${pct(-o.maxDrawdownPct)}</td><td class="num">${o.trades}${x.weak ? ' (weak)' : ''}</td>
    <td class="num">${o.efficiencyPct === null ? 'n/a' : `${o.efficiencyPct.toFixed(0)}%`}</td>
    <td class="num ${tone(x.score)}">${x.score?.toFixed(2)}</td></tr>`;
}

function robustnessHtml(s: ResearchSession): string {
  const rb = s.robustness;
  if (!rb) return '';
  const rows = rb.rows
    .map((x) =>
      x.outcome
        ? `<tr><td>${e(x.symbol)}</td><td class="num ${tone(x.outcome.returnPct)}">${pct(x.outcome.returnPct)}</td><td class="num">${pct(x.outcome.holdReturnPct)}</td><td class="num">${pct(-x.outcome.maxDrawdownPct)}</td><td class="num">${x.outcome.trades}</td><td class="num ${tone(x.score)}">${x.score?.toFixed(2)}${(x.score ?? 0) > 0 ? ' ✓' : ''}</td></tr>`
        : `<tr><td>${e(x.symbol)}</td><td colspan="5" class="loss">${e(x.error ?? 'failed')}</td></tr>`,
    )
    .join('');
  return `<section><div class="head"><h2>Multi-symbol check</h2></div>
    <p><strong class="${rb.summary.passed ? 'gain' : 'loss'}">${e(rb.summary.verdict)}</strong></p>
    <p class="note">The best test run on each symbol of the basket on its own (${day(rb.from)} → ${day(rb.to)}). ✓ = better than just holding that symbol, for the goal.</p>
    <div class="table-wrap"><table><thead><tr><th>Symbol</th><th class="num">Result</th><th class="num">Holding</th><th class="num">Max drop</th><th class="num">Trades</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function roundsHtml(s: ResearchSession): string {
  return s.rounds
    .map((round) => {
      const rows = s.experiments
        .filter((x) => x.round === round.round)
        .map((x) => experimentRow(x, s.championId))
        .join('');
      const list = (title: string, items: string[]) =>
        items.length
          ? `<ul>${items.map((i) => `<li>${e(title)}${e(i)}</li>`).join('')}</ul>`
          : '';
      return `<section class="round"><div class="head"><h2>Round ${round.round}</h2></div>
        <p>${e(round.thinking || '(no reasoning given)')}</p>
        ${list('Idea: ', round.ideas)}${list('Rejected: ', round.rejected)}
        ${rows ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Test</th><th class="num">Unseen</th><th class="num">Buy &amp; hold</th><th class="num">Max DD</th><th class="num">Trades</th><th class="num">Efficiency</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
      </section>`;
    })
    .join('');
}

export function renderResearchHtml(
  s: ResearchSession,
  holdout: WalkForwardResult | null,
  chartLibrary: string,
): string {
  const r = s.request;
  const title = `Research: ${r.symbols.join(', ')}`;
  const champion = s.experiments.find((x) => x.id === s.championId);
  const meta = `goal: ${GOAL_TEXT[r.goal]} · research ${day(r.from)} → ${day(s.researchTo)} · holdout ${day(s.researchTo)} → ${day(r.to)} · ${s.experiments.length} tests in ${s.rounds.length} rounds · stopped: ${s.stoppedBecause ?? 'n/a'}`;
  const chart = holdout && holdout.equityCurve.length > 0;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title><style>${BASE_STYLE}${AI_SUMMARY_STYLE}${STYLE}</style></head>
<body><main>
  <h1>${e(title)}</h1>
  <p class="meta">${e(meta)}</p>
  ${s.holdout ? `<p><strong class="${s.candidate ? 'gain' : 'loss'}">${s.candidate ? 'Paper-trading candidate: passed the holdout and the multi-symbol check.' : 'Not a paper-trading candidate: it did not pass every check (holdout better than holding, and most symbols of the basket).'}</strong></p>` : ''}
  ${s.holdout ? `<div class="tiles">${holdoutTiles(s.holdout.outcome, s.holdout.score, champion)}</div>` : ''}
  ${s.verdict ? renderAiSummaryHtml(s.verdict) : ''}
  ${
    champion
      ? `<section class="champion-card"><div class="head"><h2>Best test (#${champion.id})</h2></div>
    <p><code>${e(planLabel(champion.plan))}</code></p>
    <p class="note">Chosen on the research period only. The holdout numbers above are its only run on data no test had seen: that's the honest result. "Latest pick" is the setting its walk-forward picked on the most recent training window.</p></section>`
      : ''
  }
  ${chart ? `<section><div class="head"><h2>Holdout: equity vs buy &amp; hold</h2></div><div id="wf-chart"></div></section>` : ''}
  ${robustnessHtml(s)}
  ${roundsHtml(s)}
  <footer>${e(DISCLAIMER)} Tests were proposed by an AI and can be wrong.</footer>
</main>
${
  chart
    ? `<script type="application/json" id="wf-data">${jsonForScript(chartData(holdout))}</script>
<script>${scriptSafe(chartLibrary)}</script>
<script>(${renderWalkForwardChart.toString()})(JSON.parse(document.getElementById('wf-data').textContent), window.LightweightCharts);</script>`
    : ''
}
</body></html>
`;
}

export async function writeResearchHtml(
  path: string,
  s: ResearchSession,
  holdout: WalkForwardResult | null,
): Promise<void> {
  await writeFile(
    path,
    renderResearchHtml(s, holdout, await loadChartLibrary()),
  );
}
