// Draws every app icon from public/icon.svg: node scripts/make-icons.mjs public
// No image tools needed: the SVG's gradient tile, strokes and fills are rasterized here (4x4 supersampled).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { png } from './png.mjs';
import { ico } from './ico.mjs';
import { readIcon } from './svg-shapes.mjs';

const { gradient, strokes, fills, highlight } = readIcon(
  readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8'),
);
const FG = [255, 255, 255];
const S = 4; // supersampling per axis

// Stroke segments bucketed into a 16x16 grid over the 512 box, so each sample only checks nearby segments.
const CELL = 32;
const grid = Array.from({ length: 256 }, () => []);
for (const { pts, w } of strokes)
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]],
      r = w / 2 + 1;
    const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - r) / CELL)),
      x1 = Math.min(15, Math.floor((Math.max(a[0], b[0]) + r) / CELL));
    const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - r) / CELL)),
      y1 = Math.min(15, Math.floor((Math.max(a[1], b[1]) + r) / CELL));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) grid[gy * 16 + gx].push([a, b, w / 2]);
  }

function onStroke(x, y) {
  if (x < 0 || y < 0 || x >= 512 || y >= 512) return false;
  for (const [[ax, ay], [bx, by], r] of grid[Math.floor(y / CELL) * 16 + Math.floor(x / CELL)]) {
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= r) return true;
  }
  return false;
}
function inFill(x, y) {
  for (const { poly } of fills) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i],
        [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
function tile(u, v) {
  const { from, to, stops } = gradient;
  const gx = to[0] - from[0],
    gy = to[1] - from[1];
  const t = Math.min(1, Math.max(0, ((u / 512 - from[0]) * gx + (v / 512 - from[1]) * gy) / (gx * gx + gy * gy)));
  return stops[0].map((c, i) => c + (stops[1][i] - c) * t);
}
/** Signed distance to the rounded square's edge (negative inside). */
function edge(u, v, radius) {
  const cx = Math.min(Math.max(u, radius), 512 - radius),
    cy = Math.min(Math.max(v, radius), 512 - radius);
  const corner = Math.hypot(u - cx, v - cy) - radius;
  const inset = -Math.min(u, v, 512 - u, 512 - v);
  return radius ? Math.max(corner, inset) : inset;
}

/**
 * size: pixels; radius: corner radius in the 512 box (0 = full-bleed square);
 * scale: the logo's size inside (maskable icons keep it in the middle 80%).
 */
function icon(size, { radius, scale }) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let bg = 0,
        fg = 0,
        hl = 0;
      const col = [0, 0, 0];
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const u = ((x + (sx + 0.5) / S) / size) * 512,
            v = ((y + (sy + 0.5) / S) / size) * 512;
          const d = edge(u, v, radius);
          if (d > 0) continue;
          bg++;
          const c = tile(u, v);
          for (let i = 0; i < 3; i++) col[i] += c[i];
          if (highlight && radius && d > -highlight.w) hl++;
          const lu = (u - 256) / scale + 256,
            lv = (v - 256) / scale + 256;
          if (inFill(lu, lv) || onStroke(lu, lv)) fg++;
        }
      const n = S * S,
        a = bg / n,
        w = fg / n,
        h = ((hl / n) * (highlight ? highlight.opacity : 0)) / Math.max(a, 1e-9);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const base = a ? col[c] / bg : 0;
        const lit = base + (255 - base) * h;
        out[i + c] = a ? Math.round((lit * (a - w) + FG[c] * w) / a) : 0;
      }
      out[i + 3] = Math.round(a * 255);
    }
  return png(size, out);
}

const pub = process.argv[2];
mkdirSync(`${pub}/icons`, { recursive: true });
const rounded = { radius: 112, scale: 1 };
for (const s of [192, 512, 1024]) writeFileSync(`${pub}/icons/icon-${s}.png`, icon(s, rounded));
// Maskable: full-bleed background, the logo in the safe middle (Android crops to its own shape).
for (const s of [192, 512]) writeFileSync(`${pub}/icons/icon-maskable-${s}.png`, icon(s, { radius: 0, scale: 0.78 }));
// iOS rounds the corners itself and wants no transparency.
writeFileSync(`${pub}/icons/apple-touch-icon.png`, icon(180, { radius: 0, scale: 0.86 }));
// Browser tab: a multi-size .ico next to the SVG.
writeFileSync(`${pub}/favicon.ico`, ico([16, 32, 48].map((s) => ({ size: s, data: icon(s, rounded) }))));
console.log('icons written');
