import { Tooltip } from '@mantine/core';

const W = 120;
const H = 34;

/**
 * A small price chart: the closes, a dashed line at your buy price and a dot
 * on the day you bought. Green above the buy price, red below.
 */
export function Sparkline({
  points,
  entryPrice,
  boughtAt,
}: {
  points: Array<{ t: string; c: number }>;
  entryPrice: number;
  boughtAt: string | null;
}) {
  if (points.length < 2) return null;
  const closes = points.map((p) => p.c);
  const lo = Math.min(...closes, entryPrice);
  const hi = Math.max(...closes, entryPrice);
  const pad = (hi - lo) * 0.08 || 1;
  const x = (i: number) => (i / (points.length - 1)) * (W - 4) + 2;
  const y = (v: number) => H - 2 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (H - 4);
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`)
    .join(' ');
  const last = closes.at(-1) as number;
  const color = last >= entryPrice ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-red-6)';
  const buyDay = boughtAt?.slice(0, 10);
  const buyIndex = buyDay ? points.findIndex((p) => p.t >= buyDay) : -1;
  return (
    <Tooltip
      label={`Price since ${points[0].t}; dashed line = your buy price $${entryPrice.toFixed(2)}`}
      withArrow
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Price since a month before the buy"
      >
        <line
          x1={0}
          x2={W}
          y1={y(entryPrice)}
          y2={y(entryPrice)}
          stroke="var(--mantine-color-dimmed)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        {buyIndex >= 0 && (
          <circle cx={x(buyIndex)} cy={y(entryPrice)} r={2.6} fill="var(--mantine-color-blue-5)" />
        )}
      </svg>
    </Tooltip>
  );
}
