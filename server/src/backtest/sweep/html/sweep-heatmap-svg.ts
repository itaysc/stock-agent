import { escapeHtml } from '../../report/html-utils.js';
import type { SweepRunView } from './sweep-html-data.js';

const sortedValues = (values: string[]) =>
  [...new Set(values)].sort((a, b) => Number(a) - Number(b));

export const pctLabel = (n: number) =>
  `${n > 0 ? '+' : ''}${n.toFixed(Math.abs(n) >= 100 ? 0 : 1)}%`;

export const runTooltip = (r: SweepRunView) =>
  `${r.label}\nReturn ${pctLabel(r.returnPct)} · Max DD -${r.maxDrawdownPct.toFixed(1)}%` +
  ` · ${r.trades} trades${r.beatHold ? ' · beat buy & hold' : ''}`;

/** Params that take more than one value across these runs. */
export function variedParams(runs: SweepRunView[]): string[] {
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r.params)))];
  return keys.filter((k) => new Set(runs.map((r) => r.params[k])).size > 1);
}

function fill(returnPct: number, maxAbs: number) {
  const strength = maxAbs > 0 ? Math.abs(returnPct) / maxAbs : 0;
  return {
    color: returnPct >= 0 ? 'var(--gain)' : 'var(--loss)',
    opacity: (0.12 + 0.68 * strength).toFixed(2),
  };
}

/** One strategy's runs as a heatmap (2 varied params) or bar chart (1); null otherwise. */
export function strategyChartSvg(runs: SweepRunView[]): string | null {
  const varied = variedParams(runs);
  if (varied.length === 2) return gridSvg(runs, varied[0], varied[1]);
  if (varied.length === 1) return barsSvg(runs, varied[0]);
  return null;
}

function gridSvg(runs: SweepRunView[], xKey: string, yKey: string): string {
  const xs = sortedValues(runs.map((r) => r.params[xKey]));
  const ys = sortedValues(runs.map((r) => r.params[yKey]));
  const [cw, ch, left, top] = [72, 36, 64, 44];
  const width = left + xs.length * cw + 8;
  const height = top + ys.length * ch + 8;
  const maxAbs = Math.max(...runs.map((r) => Math.abs(r.returnPct)), 0.01);
  const parts = [
    `<svg class="heatmap" viewBox="0 0 ${width} ${height}" style="max-width:${width}px" role="img" aria-label="Return by ${escapeHtml(xKey)} and ${escapeHtml(yKey)}">`,
    `<text class="axis-title" x="${left + (xs.length * cw) / 2}" y="14" text-anchor="middle">${escapeHtml(xKey)}</text>`,
    `<text class="axis-title" transform="translate(14 ${top + (ys.length * ch) / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(yKey)}</text>`,
  ];
  xs.forEach((x, i) =>
    parts.push(
      `<text class="tick" x="${left + i * cw + cw / 2}" y="${top - 10}" text-anchor="middle">${escapeHtml(x)}</text>`,
    ),
  );
  ys.forEach((y, j) => {
    const cy = top + j * ch;
    parts.push(
      `<text class="tick" x="${left - 10}" y="${cy + ch / 2 + 4}" text-anchor="end">${escapeHtml(y)}</text>`,
    );
    xs.forEach((x, i) => {
      const cx = left + i * cw;
      const run = runs.find(
        (r) => r.params[xKey] === x && r.params[yKey] === y,
      );
      if (!run) {
        parts.push(
          `<rect class="empty" x="${cx}" y="${cy}" width="${cw - 4}" height="${ch - 4}" rx="5"/>`,
          `<text class="cell-text muted-fill" x="${cx + cw / 2 - 2}" y="${cy + ch / 2 + 2}" text-anchor="middle">—</text>`,
        );
        return;
      }
      const f = fill(run.returnPct, maxAbs);
      parts.push(
        `<g class="cell${run.beatHold ? ' beat' : ''}" data-id="${run.id}"><title>${escapeHtml(runTooltip(run))}</title>`,
        `<rect x="${cx}" y="${cy}" width="${cw - 4}" height="${ch - 4}" rx="5" fill="${f.color}" fill-opacity="${f.opacity}"/>`,
        `<text class="cell-text" x="${cx + cw / 2 - 2}" y="${cy + ch / 2 + 2}" text-anchor="middle">${pctLabel(run.returnPct)}</text></g>`,
      );
    });
  });
  parts.push('</svg>');
  return parts.join('');
}

function barsSvg(runs: SweepRunView[], key: string): string {
  const values = sortedValues(runs.map((r) => r.params[key]));
  const [bw, plot, left, top] = [56, 160, 16, 24];
  const returns = runs.map((r) => r.returnPct);
  const hi = Math.max(0, ...returns);
  const lo = Math.min(0, ...returns);
  const scale = plot / Math.max(hi - lo, 0.01);
  const zero = top + hi * scale;
  const width = left * 2 + values.length * bw;
  const height = top + plot + 44;
  const parts = [
    `<svg class="heatmap" viewBox="0 0 ${width} ${height}" style="max-width:${width}px" role="img" aria-label="Return by ${escapeHtml(key)}">`,
    `<line class="zero" x1="${left}" x2="${width - left}" y1="${zero}" y2="${zero}"/>`,
  ];
  values.forEach((value, i) => {
    const run = runs.find((r) => r.params[key] === value);
    const x = left + i * bw + 6;
    parts.push(
      `<text class="tick" x="${x + (bw - 12) / 2}" y="${top + plot + 20}" text-anchor="middle">${escapeHtml(value)}</text>`,
    );
    if (!run) return;
    const h = Math.max(Math.abs(run.returnPct) * scale, 1);
    const y = run.returnPct >= 0 ? zero - h : zero;
    const labelY = run.returnPct >= 0 ? y - 6 : y + h + 14;
    parts.push(
      `<g class="cell${run.beatHold ? ' beat' : ''}" data-id="${run.id}"><title>${escapeHtml(runTooltip(run))}</title>`,
      `<rect x="${x}" y="${y}" width="${bw - 12}" height="${h}" rx="4" fill="${run.returnPct >= 0 ? 'var(--gain)' : 'var(--loss)'}" fill-opacity="0.75"/>`,
      `<text class="cell-text" x="${x + (bw - 12) / 2}" y="${labelY}" text-anchor="middle">${pctLabel(run.returnPct)}</text></g>`,
    );
  });
  parts.push(
    `<text class="axis-title" x="${width / 2}" y="${height - 4}" text-anchor="middle">${escapeHtml(key)}</text>`,
    '</svg>',
  );
  return parts.join('');
}
