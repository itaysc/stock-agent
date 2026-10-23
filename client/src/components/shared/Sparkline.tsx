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
  fluid = false,
}: {
  points: Array<{ t: string; c: number }>;
  /** Your buy price (a dashed line; the color says above or below it). Without one: up or down since the start. */
  entryPrice?: number | null;
  boughtAt?: string | null;
  /** Fill the width of its box (the phone's cards), a little taller. */
  fluid?: boolean;
}) {
  const base = entryPrice ?? points[0]?.c ?? 0;
  if (points.length < 2) return null;
  const closes = points.map((p) => p.c);
  const lo = Math.min(...closes, base);
  const hi = Math.max(...closes, base);
  const pad = (hi - lo) * 0.08 || 1;
  const x = (i: number) => (i / (points.length - 1)) * (W - 4) + 2;
  const y = (v: number) => H - 2 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (H - 4);
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`)
    .join(' ');
  const last = closes.at(-1) as number;
  const color = last >= base ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-red-6)';
  const buyDay = boughtAt?.slice(0, 10);
  const buyIndex = buyDay ? points.findIndex((p) => p.t >= buyDay) : -1;
  return (
    <Tooltip
      label={
        entryPrice == null
          ? `Price since ${points[0].t.slice(0, 10)}`
          : `Price since ${points[0].t.slice(0, 10)}; dashed line = your buy price $${entryPrice.toFixed(2)}`
      }
      withArrow
    >
      <svg
        width={fluid ? '100%' : W}
        height={fluid ? 44 : H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio={fluid ? 'none' : undefined}
        role="img"
        aria-label="Price trend"
        style={{ display: 'block' }}
      >
        {entryPrice != null && (
          <line
            x1={0}
            x2={W}
            y1={y(entryPrice)}
            y2={y(entryPrice)}
            stroke="var(--mantine-color-dimmed)"
            strokeDasharray="3 3"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {buyIndex >= 0 &&
          entryPrice != null &&
          (fluid ? (
            // Stretched to the card's width: a round cap of a zero-length line stays a circle.
            <line
              x1={x(buyIndex)}
              x2={x(buyIndex)}
              y1={y(entryPrice)}
              y2={y(entryPrice)}
              stroke="var(--mantine-color-blue-5)"
              strokeWidth={7}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <circle
              cx={x(buyIndex)}
              cy={y(entryPrice)}
              r={2.6}
              fill="var(--mantine-color-blue-5)"
            />
          ))}
      </svg>
    </Tooltip>
  );
}
