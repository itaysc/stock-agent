import { Alert, Badge, Button, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { api } from '../../api/client';
import type { TrackedTrade, Tracking } from '../../api/broker-types';
import { pct } from '../../lib/format';
import { tradingDay } from '../../lib/when';

const W = 600;
const H = 120;

/** Live (solid) and backtest (dashed) worth over the same days. */
function Lines({ days }: { days: Tracking['days'] }) {
  const values = days.flatMap((d) => [d.live, ...(d.test === null ? [] : [d.test])]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => (days.length > 1 ? (i / (days.length - 1)) * W : W / 2);
  const y = (v: number) => (hi > lo ? H - ((v - lo) / (hi - lo)) * (H - 8) - 4 : H / 2);
  const path = (pick: (d: Tracking['days'][number]) => number | null) =>
    days
      .map((d, i) => [i, pick(d)] as const)
      .filter((p): p is readonly [number, number] => p[1] !== null)
      .map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
      <path
        d={path((d) => d.test)}
        fill="none"
        stroke="var(--mantine-color-gray-5)"
        strokeWidth={2}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path((d) => d.live)}
        fill="none"
        stroke="var(--mantine-color-blue-5)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const list = (ts: TrackedTrade[]) =>
  ts.map((t) => `${t.side} ${t.symbol} (${tradingDay(t.date)})`).join(', ');

/** Is it doing what the backtest says it should? Live next to the same setup backtested over the same days. */
export function LiveVsBacktest({ investmentId }: { investmentId: string }) {
  const [data, setData] = useState<Tracking | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.brokerTracking(investmentId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const gap = data?.gapPct ?? null;
  const verdict =
    gap === null
      ? null
      : Math.abs(gap) <= 1
        ? { color: 'teal', text: 'Matches the backtest' }
        : Math.abs(gap) <= 3
          ? { color: 'yellow', text: 'Close to the backtest' }
          : { color: 'red', text: 'Differs from the backtest' };
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Title order={5}>Live vs backtest</Title>
        <Button size="compact-sm" variant="light" onClick={() => void load()} loading={loading}>
          {data === undefined ? 'Compare' : 'Refresh'}
        </Button>
      </Group>
      {data === undefined && !loading && (
        <Text size="sm" c="dimmed">
          Does it behave as designed? This runs the same settings and amount on the same days and
          shows them side by side.
        </Text>
      )}
      {loading && data === undefined && <Loader size="sm" />}
      {error && <Alert color="red">{error}</Alert>}
      {data === null && <Text size="sm">No trading days yet.</Text>}
      {data && (
        <Stack gap="xs">
          <Group gap="xs">
            <Text size="sm">
              Since {tradingDay(data.from)}: live <b>{pct(data.liveReturnPct)}</b>, backtest{' '}
              <b>{pct(data.testReturnPct)}</b>
              {gap !== null && ` (difference ${gap >= 0 ? '+' : ''}${gap.toFixed(2)} points)`}
            </Text>
            {verdict && (
              <Badge color={verdict.color} variant="light">
                {verdict.text}
              </Badge>
            )}
          </Group>
          {data.days.length > 1 && <Lines days={data.days} />}
          <Text size="xs" c="dimmed">
            Blue: live · dashed grey: backtest. Same trades: {data.trades.both.length}
            {data.trades.liveOnly.length > 0 && ` · only live: ${list(data.trades.liveOnly)}`}
            {data.trades.testOnly.length > 0 &&
              ` · only in the backtest: ${list(data.trades.testOnly)}`}
          </Text>
          <Text size="xs" c="dimmed">
            Usual reasons for a difference: the news and earnings checks (the backtest can&apos;t
            read the news), your own sells and levels, and real fill prices. A small gap is normal;
            a growing one is worth a look.
          </Text>
        </Stack>
      )}
    </Paper>
  );
}
