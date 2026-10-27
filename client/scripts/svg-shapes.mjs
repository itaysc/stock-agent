// Reads the small subset of SVG that public/icon.svg uses, as plain geometry in the 512 box:
// a linear-gradient tile, stroked paths (M + cubic C segments, or M/L/Z polygons) and filled polygons.

const num = (s) => s.split(/[\s,]+/).filter(Boolean).map(Number);
const attr = (tag, name) => (tag.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];

/** Flattens a path's d attribute into polylines (one per M). */
export function flatten(d, steps = 40) {
  const lines = [];
  let cur = [];
  const re = /([MLCZ])([^MLCZ]*)/g;
  let m;
  while ((m = re.exec(d))) {
    const n = num(m[2]);
    if (m[1] === 'M') {
      if (cur.length) lines.push(cur);
      cur = [[n[0], n[1]]];
    } else if (m[1] === 'L') {
      for (let i = 0; i < n.length; i += 2) cur.push([n[i], n[i + 1]]);
    } else if (m[1] === 'C') {
      for (let i = 0; i < n.length; i += 6) {
        const [x0, y0] = cur[cur.length - 1];
        const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6);
        for (let k = 1; k <= steps; k++) {
          const t = k / steps,
            u = 1 - t;
          cur.push([
            u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
          ]);
        }
      }
    } else if (m[1] === 'Z') {
      cur.push(cur[0]);
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const hex = (h) => h.match(/../g).map((x) => parseInt(x, 16));

/** @returns {{gradient, strokes: {pts, w}[], fills: {poly}[], highlight}} */
export function readIcon(svg) {
  const g = svg.match(/<linearGradient[^>]*>[\s\S]*?<\/linearGradient>/)[0];
  const gradient = {
    from: ['x1', 'y1'].map((a) => Number(attr(g, a))),
    to: ['x2', 'y2'].map((a) => Number(attr(g, a))),
    stops: [...g.matchAll(/stop-color="#([0-9a-f]{6})"/gi)].map((s) => hex(s[1])),
  };
  const strokes = [],
    fills = [];
  let highlight = null;
  // Group-level stroke width applies to the paths inside it.
  for (const grp of svg.matchAll(/<g([^>]*)>([\s\S]*?)<\/g>/g)) {
    const w = Number(attr(grp[1], 'stroke-width'));
    for (const p of grp[2].matchAll(/<path d="([^"]*)"/g)) for (const pts of flatten(p[1])) strokes.push({ pts, w });
  }
  // Standalone paths: filled, optionally with a stroke of their own.
  for (const p of svg.matchAll(/<path([^>]*)\/>/g)) {
    if (!attr(p[1], 'fill') || attr(p[1], 'fill') === 'none') continue;
    for (const pts of flatten(attr(p[1], 'd'))) {
      fills.push({ poly: pts });
      const w = Number(attr(p[1], 'stroke-width'));
      if (w) strokes.push({ pts, w });
    }
  }
  const hl = svg.match(/<rect[^>]*stroke-opacity="([^"]*)"[^>]*stroke-width="([^"]*)"/);
  if (hl) highlight = { opacity: Number(hl[1]), w: Number(hl[2]) };
  return { gradient, strokes, fills, highlight };
}
