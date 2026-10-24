// Draws the app icons (public/icons): node scripts/make-icons.mjs public/icons. No image tools needed (4x4 supersampled).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLUE = [76, 110, 245];
// The logo in a 512 box (same as public/icon.svg).
const LINE = [
  [112, 336],
  [208, 240],
  [272, 304],
  [400, 160],
];
const WIDTH = 44;

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax,
    dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
/**
 * size: pixels; radius: corner radius in the 512 box (0 = full square);
 * scale: the logo's size inside (maskable icons keep it in the middle 80%).
 */
function icon(size, { radius, scale }) {
  const out = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let bg = 0,
        fg = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const u = ((x + (sx + 0.5) / S) / size) * 512;
          const v = ((y + (sy + 0.5) / S) / size) * 512;
          // Inside the rounded square?
          const cx = Math.min(Math.max(u, radius), 512 - radius);
          const cy = Math.min(Math.max(v, radius), 512 - radius);
          if (radius === 0 || Math.hypot(u - cx, v - cy) <= radius) bg++;
          // On the line (scaled about the center)?
          const lu = (u - 256) / scale + 256,
            lv = (v - 256) / scale + 256;
          let d = Infinity;
          for (let i = 0; i < LINE.length - 1; i++)
            d = Math.min(d, segDist(lu, lv, LINE[i], LINE[i + 1]));
          if (d <= WIDTH / 2) fg++;
        }
      const n = S * S,
        a = bg / n,
        w = Math.min(fg, bg) / n;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++)
        out[i + c] = a ? Math.round((BLUE[c] * (a - w) + 255 * w) / a) : 0;
      out[i + 3] = Math.round(a * 255);
    }
  return png(size, out);
}
const dir = process.argv[2];
writeFileSync(`${dir}/icon-192.png`, icon(192, { radius: 112, scale: 1 }));
writeFileSync(`${dir}/icon-512.png`, icon(512, { radius: 112, scale: 1 }));
// Maskable: full-bleed background, the logo in the safe middle (Android crops to its own shape).
writeFileSync(`${dir}/icon-maskable-512.png`, icon(512, { radius: 0, scale: 0.78 }));
// iOS rounds the corners itself and wants no transparency.
writeFileSync(`${dir}/apple-touch-icon.png`, icon(180, { radius: 0, scale: 0.86 }));
console.log('icons written');
