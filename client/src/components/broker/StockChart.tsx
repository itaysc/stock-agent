import {
  Alert,
  Center,
  Chip,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  useComputedColorScheme,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { ChartRange, StockChartData } from '../../api/broker-types';
import { pct } from '../../lib/format';
import { drawStockChart, MA_COLORS, type Layer } from './stock-chart-draw';

const usd = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
const RANGES: Array<{ value: ChartRange; label: string }> = [
  { value: '1d', label: '1D' },
  { value: '5d', label: '5D' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'buy', label: 'Since buy' },
];
const LAYERS: Array<{ value: Layer; label: string }> = [
  { value: 'bought', label: 'Buy price' },
  { value: 'stop', label: 'Stop' },
  { value: 'target', label: 'Profit target' },
  { value: 'high', label: 'High since buy' },
  { value: 'trades', label: 'Trades' },
  { value: 'ma20', label: '20-day avg' },
  { value: 'ma50', label: '50-day avg' },
  { value: 'ma200', label: '200-day avg' },
];

/** A stock's price for a range, with its buy price, stop, high and trades, and SPY to compare. */
export function StockChart({ investmentId, symbol }: { investmentId: string; symbol: string }) {
  const box = useRef<HTMLDivElement>(null);
  const dark = useComputedColorScheme('light') === 'dark';
  const [range, setRange] = useState<ChartRange>('buy');
  const [compare, setCompare] = useState(false);
  const [layers, setLayers] = useState<string[]>(['bought', 'stop', 'target', 'high', 'trades']);
  const [data, setData] = useState<StockChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .brokerChart(investmentId, symbol, range, compare)
      .then(setData, (err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [investmentId, symbol, range, compare]);
  useEffect(() => {
    if (!data || !box.current) return;
    return drawStockChart(box.current, data, { dark, compare, layers: layers as Layer[] });
  }, [data, dark, compare, layers]);

  const first = data?.closes[0]?.close ?? null;
  const last = data?.closes.at(-1)?.close ?? null;
  const change = first && last ? (last / first - 1) * 100 : null;
  const spyFirst = data?.spy[0]?.close;
  const spyLast = data?.spy.at(-1)?.close;
  const spyChange = spyFirst && spyLast ? (spyLast / spyFirst - 1) * 100 : null;
  const label = RANGES.find((r) => r.value === range)?.label ?? '';
  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <SegmentedControl
          size="xs"
          value={range}
          onChange={(v) => setRange(v as ChartRange)}
          data={RANGES}
        />
        <Switch
          size="sm"
          label="Compare with SPY (%)"
          checked={compare}
          onChange={(e) => setCompare(e.currentTarget.checked)}
        />
      </Group>
      {!compare && (
        <Chip.Group multiple value={layers} onChange={setLayers}>
          <Group gap={6}>
            {LAYERS.map((l) => {
              const ma = l.value.startsWith('ma');
              return (
                <Chip
                  key={l.value}
                  value={l.value}
                  size="xs"
                  variant="outline"
                  color={ma ? MA_COLORS[l.value.slice(2)] : undefined}
                  // A 200-day average doesn't fit the 5-minute bars of 1D / 5D.
                  disabled={ma && !!data?.intraday}
                >
                  {l.label}
                </Chip>
              );
            })}
          </Group>
        </Chip.Group>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {data && (
        <Group gap="lg">
          <Text size="sm">
            Now: <b>{usd(last)}</b>
            {change !== null && (
              <Text span c={change >= 0 ? 'teal' : 'red'}>
                {' '}
                ({pct(change)} over {label === 'Since buy' ? 'the chart' : label})
              </Text>
            )}
          </Text>
          {compare && spyChange !== null && (
            <Text size="sm" c="dimmed">
              SPY {pct(spyChange)}
            </Text>
          )}
          <Text size="sm">
            Bought: <b>{usd(data.entryPrice)}</b>
            {data.boughtAt ? ` on ${new Date(data.boughtAt).toLocaleDateString()}` : ''}
          </Text>
          <Text size="sm" c="red">
            Sells below: <b>{usd(data.stopPrice)}</b>
          </Text>
        </Group>
      )}
      <div style={{ position: 'relative' }}>
        <div ref={box} style={{ height: 340 }} />
        {loading && (
          <Center pos="absolute" inset={0}>
            <Loader />
          </Center>
        )}
      </div>
      {data && data.closes.length === 0 && !loading && (
        <Text size="sm" c="dimmed">
          No prices for this range yet.
        </Text>
      )}
      {data?.trades.map((t, i) => (
        <Text key={i} size="xs" c="dimmed">
          {new Date(t.time).toLocaleDateString()}: {t.side === 'buy' ? 'bought' : 'sold'} {t.qty} at{' '}
          {usd(t.price)}
          {t.why ? ` (${t.why})` : ''}
        </Text>
      ))}
    </Stack>
  );
}
