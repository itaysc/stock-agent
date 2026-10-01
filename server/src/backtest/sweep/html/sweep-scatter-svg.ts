import { escapeHtml } from '../../report/html-utils.js';
import { pctLabel, runTooltip } from './sweep-heatmap-svg.js';
import type { SweepRunView } from './sweep-html-data.js';

/** Round step sizes (1, 2, 2.5, 5 × 10^n) giving about `count` ticks. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const range = Math.max(max - min, 1e-9);
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  return ticks;
}

/**
 * Every run as a dot: x = max drawdown, y = return. Up-and-left is better
 * (more return for less pain). The dashed line is buy & hold.
 */
export function scatterSvg(
  runs: SweepRunView[],
  holdPct: number | null,
  strategies: string[],
): string {
  const [w, h, l, r, t, b] = [720, 340, 56, 16, 16, 44];
  const ddMax = Math.max(1, ...runs.map((x) => x.maxDrawdownPct)) * 1.1;
  const rets = [...runs.map((x) => x.returnPct), holdPct ?? 0, 0];
  const pad = Math.max((Math.max(...rets) - Math.min(...rets)) * 0.08, 1);
  const [yMin, yMax] = [Math.min(...rets) - pad, Math.max(...rets) + pad];
  const sx = (v: number) => l + (v / ddMax) * (w - l - r);
  const sy = (v: number) => t + ((yMax - v) / (yMax - yMin)) * (h - t - b);

  const parts = [
    `<svg class="scatter" viewBox="0 0 ${w} ${h}" role="img" aria-label="Return versus max drawdown for each run">`,
  ];
  for (const v of niceTicks(0, ddMax)) {
    parts.push(
      `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${t}" y2="${h - b}"/>`,
      `<text class="tick" x="${sx(v)}" y="${h - b + 18}" text-anchor="middle">-${v}%</text>`,
    );
  }
  for (const v of niceTicks(yMin, yMax)) {
    parts.push(
      `<line class="grid" x1="${l}" x2="${w - r}" y1="${sy(v)}" y2="${sy(v)}"/>`,
      `<text class="tick" x="${l - 8}" y="${sy(v) + 4}" text-anchor="end">${v}%</text>`,
    );
  }
  parts.push(
    `<line class="zero" x1="${l}" x2="${w - r}" y1="${sy(0)}" y2="${sy(0)}"/>`,
  );
  if (holdPct !== null) {
    parts.push(
      `<line class="hold" x1="${l}" x2="${w - r}" y1="${sy(holdPct)}" y2="${sy(holdPct)}"/>`,
      `<text class="hold-label" x="${w - r - 4}" y="${sy(holdPct) - 6}" text-anchor="end">Buy &amp; hold ${pctLabel(holdPct)}</text>`,
    );
  }
  // Draw the best runs last so they sit on top.
  for (const run of [...runs].reverse()) {
    const color = `var(--s${(strategies.indexOf(run.strategy) % 4) + 1})`;
    parts.push(
      `<circle class="dot" data-id="${run.id}" cx="${sx(run.maxDrawdownPct).toFixed(1)}" cy="${sy(run.returnPct).toFixed(1)}" r="5" fill="${color}">` +
        `<title>${escapeHtml(runTooltip(run))}</title></circle>`,
    );
  }
  parts.push(
    `<text class="axis-title" x="${l + (w - l - r) / 2}" y="${h - 6}" text-anchor="middle">Max drawdown (less is better)</text>`,
    `<text class="axis-title" transform="translate(14 ${t + (h - t - b) / 2}) rotate(-90)" text-anchor="middle">Return</text>`,
    '</svg>',
  );
  return parts.join('');
}
