import { Text } from '@mantine/core';

interface Props {
  points: Array<{ timestamp: string; equity: number }>;
  capital: number;
  height?: number;
}

/** A small equity line with the starting money as a dashed baseline. */
export function EquityLine({ points, capital, height = 120 }: Props) {
  if (points.length < 2) {
    return (
      <Text size="sm" c="dimmed">
        The chart appears after a couple of trading days.
      </Text>
    );
  }
  const values = [...points.map((p) => p.equity), capital];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 600;
  const y = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`)
    .join(' ');
  const up = points.at(-1)!.equity >= capital;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Equity over time"
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        x2={w}
        y1={y(capital)}
        y2={y(capital)}
        stroke="var(--mantine-color-dimmed)"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <path
        d={path}
        fill="none"
        stroke={`var(--mantine-color-${up ? 'teal' : 'red'}-filled)`}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
