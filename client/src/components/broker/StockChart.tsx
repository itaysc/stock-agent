import { Alert, Center, Group, Loader, Stack, Text, useComputedColorScheme } from '@mantine/core';
import {
  AreaSeries,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { StockChartData } from '../../api/broker-types';

const time = (iso: string) => Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
const usd = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);

/** A stock's price since before the buy, with its buy price, stop, high and trades. */
export function StockChart({ symbol }: { symbol: string }) {
  const box = useRef<HTMLDivElement>(null);
  const dark = useComputedColorScheme('light') === 'dark';
  const [data, setData] = useState<StockChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.brokerChart(symbol).then(setData, (err: Error) => setError(err.message));
  }, [symbol]);
  useEffect(() => {
    if (!data || !box.current) return;
    const text = dark ? '#c9c9c9' : '#333';
    const grid = dark ? '#2c2e33' : '#eee';
    const chart = createChart(box.current, {
      height: 320,
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const area = chart.addSeries(AreaSeries, {
      lineColor: '#4c6ef5',
      topColor: 'rgba(76,110,245,0.25)',
      bottomColor: 'rgba(76,110,245,0.02)',
      lineWidth: 2,
    });
    area.setData(data.closes.map((c) => ({ time: time(c.time), value: c.close })));
    const line = (price: number | null, color: string, title: string, style = LineStyle.Solid) =>
      price !== null &&
      area.createPriceLine({
        price,
        color,
        title,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
      });
    line(data.entryPrice, '#228be6', 'Bought');
    line(data.stopPrice, '#fa5252', 'Stop (sells below)', LineStyle.Dashed);
    line(data.takeProfitPrice, '#12b886', 'Take profit', LineStyle.Dashed);
    line(data.highSinceBuy, '#868e96', 'High since buy', LineStyle.Dotted);
    // A fill (e.g. 09:35) is drawn on its day's point.
    const days = data.closes.map((c) => time(c.time));
    const onDay = (iso: string) => days.findLast((d) => d <= time(iso)) ?? days[0];
    createSeriesMarkers(
      area,
      data.trades
        .filter(() => days.length > 0)
        .map((t) => ({
          time: onDay(t.time),
          position: t.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
          color: t.side === 'buy' ? '#12b886' : '#fa5252',
          shape: t.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
          text: `${t.side === 'buy' ? 'Buy' : 'Sell'} ${usd(t.price)}`,
        }))
        .sort((a, b) => a.time - b.time),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, dark]);

  if (error) return <Alert color="red">{error}</Alert>;
  if (!data)
    return (
      <Center h={320}>
        <Loader />
      </Center>
    );
  const last = data.closes.at(-1)?.close ?? null;
  return (
    <Stack gap="xs">
      <Group gap="lg">
        <Text size="sm">
          Bought: <b>{usd(data.entryPrice)}</b>
          {data.boughtAt ? ` on ${new Date(data.boughtAt).toLocaleDateString()}` : ''}
        </Text>
        <Text size="sm">
          Now: <b>{usd(last)}</b>
        </Text>
        <Text size="sm">
          High since buy: <b>{usd(data.highSinceBuy)}</b>
        </Text>
        <Text size="sm" c="red">
          Sells below: <b>{usd(data.stopPrice)}</b>
        </Text>
      </Group>
      <div ref={box} />
      {data.trades.map((t, i) => (
        <Text key={i} size="xs" c="dimmed">
          {new Date(t.time).toLocaleDateString()}: {t.side === 'buy' ? 'bought' : 'sold'} {t.qty} at{' '}
          {usd(t.price)}
          {t.why ? ` (${t.why})` : ''}
        </Text>
      ))}
    </Stack>
  );
}
