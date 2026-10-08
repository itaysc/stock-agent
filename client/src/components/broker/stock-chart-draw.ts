import {
  AreaSeries,
  type AutoscaleInfo,
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { StockChartData } from '../../api/broker-types';

export type Layer = 'bought' | 'stop' | 'target' | 'high' | 'trades' | 'ma20' | 'ma50' | 'ma200';

/** Each moving average's colour. */
export const MA_COLORS: Record<string, string> = { 20: '#f59f00', 50: '#be4bdb', 200: '#20c997' };

/** A chart time. The library shows times as UTC: shift by the local offset so 1D/5D read in your time. */
const time = (iso: string) => {
  const t = new Date(iso);
  return (Math.floor(t.getTime() / 1000) - t.getTimezoneOffset() * 60) as UTCTimestamp;
};
const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Draws the stock chart into `box` and returns a cleanup function. In price
 * mode: the closes with the chosen levels and trades; in compare mode: the
 * stock and SPY as % change from the start of the range.
 */
export function drawStockChart(
  box: HTMLElement,
  data: StockChartData,
  opts: { dark: boolean; compare: boolean; layers: Layer[] },
): () => void {
  const text = opts.dark ? '#c9c9c9' : '#333';
  const grid = opts.dark ? '#2c2e33' : '#eee';
  const chart = createChart(box, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: text },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: data.intraday, secondsVisible: false },
  });
  if (opts.compare) {
    const asPct = (rows: StockChartData['closes']) => {
      const base = rows[0]?.close;
      return base
        ? rows.map((r) => ({ time: time(r.time), value: (r.close / base - 1) * 100 }))
        : [];
    };
    const fmt = { type: 'custom' as const, formatter: (v: number) => `${v.toFixed(1)}%` };
    chart
      .addSeries(LineSeries, {
        color: '#4c6ef5',
        lineWidth: 2,
        title: data.symbol,
        priceFormat: fmt,
      })
      .setData(asPct(data.closes));
    chart
      .addSeries(LineSeries, {
        color: '#868e96',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'SPY',
        priceFormat: fmt,
      })
      .setData(asPct(data.spy));
  } else {
    const on = (l: Layer) => opts.layers.includes(l);
    // The levels that are on stay in view (price lines alone don't widen the scale).
    const levels = [
      on('bought') && data.entryPrice,
      on('stop') && data.stopPrice,
      on('target') && data.takeProfitPrice,
      on('high') && data.highSinceBuy,
    ].filter((x): x is number => typeof x === 'number');
    const area = chart.addSeries(AreaSeries, {
      lineColor: '#4c6ef5',
      topColor: 'rgba(76,110,245,0.25)',
      bottomColor: 'rgba(76,110,245,0.02)',
      lineWidth: 2,
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        if (!info?.priceRange || !levels.length) return info;
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, ...levels),
            maxValue: Math.max(info.priceRange.maxValue, ...levels),
          },
        };
      },
    });
    area.setData(data.closes.map((c) => ({ time: time(c.time), value: c.close })));
    for (const [days, points] of Object.entries(data.ma ?? {}))
      if (on(`ma${days}` as Layer) && points.length)
        chart
          .addSeries(LineSeries, {
            color: MA_COLORS[days],
            lineWidth: 1,
            title: `${days}-day avg`,
            priceLineVisible: false,
            lastValueVisible: false,
          })
          .setData(points.map((p) => ({ time: time(p.time), value: p.value })));
    const line = (
      show: boolean,
      price: number | null,
      color: string,
      title: string,
      style = LineStyle.Solid,
    ) =>
      show &&
      price !== null &&
      area.createPriceLine({
        price,
        color,
        title,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
      });
    line(on('bought'), data.entryPrice, '#228be6', 'Bought');
    line(on('stop'), data.stopPrice, '#fa5252', 'Stop (sells below)', LineStyle.Dashed);
    line(on('target'), data.takeProfitPrice, '#12b886', 'Take profit', LineStyle.Dashed);
    line(on('high'), data.highSinceBuy, '#868e96', 'High since buy', LineStyle.Dotted);
    // A fill (e.g. 09:35) is drawn on its bar (the day's point on daily charts).
    const points = data.closes.map((c) => time(c.time));
    const onBar = (iso: string) => points.findLast((p) => p <= time(iso)) ?? points[0];
    if (on('trades') && points.length)
      createSeriesMarkers(
        area,
        data.trades
          .map((t) => ({
            time: onBar(t.time),
            position: t.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
            color: t.side === 'buy' ? '#12b886' : '#fa5252',
            shape: t.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
            text: `${t.side === 'buy' ? 'Buy' : 'Sell'} ${usd(t.price)}`,
          }))
          .sort((a, b) => a.time - b.time),
      );
  }
  chart.timeScale().fitContent();
  return () => chart.remove();
}
