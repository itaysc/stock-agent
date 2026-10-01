import type * as Charts from 'lightweight-charts';

export interface WalkForwardChartData {
  times: number[];
  equity: number[];
  buyAndHold: number[];
  /** Test-window starts, as indexes into `times`, labelled W1, W2, ... */
  windowStarts: Array<{ index: number; label: string }>;
}

/**
 * Browser-side: stitched out-of-sample equity vs buy & hold, with a marker at
 * each test window. Embedded via toString(): no imports or outer variables.
 */
export function renderWalkForwardChart(
  data: WalkForwardChartData,
  lc: typeof Charts,
): void {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const el = document.getElementById('wf-chart') as HTMLElement;
  const dollars = {
    type: 'custom' as const,
    formatter: (p: number) => `$${Math.round(p).toLocaleString('en-US')}`,
  };
  const points = (values: number[]) =>
    values.map((value, i) => ({
      time: data.times[i],
      value,
    })) as unknown as Charts.LineData[];

  const chart = lc.createChart(el, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, fontFamily: v('--font') },
    timeScale: { minBarSpacing: 0.01 },
    handleScroll: { mouseWheel: false },
    handleScale: { mouseWheel: false },
  });
  const hold = chart.addSeries(lc.LineSeries, {
    lineWidth: 1,
    lineStyle: 2,
    priceFormat: dollars,
    title: 'Buy & hold',
  });
  hold.setData(points(data.buyAndHold));
  const equity = chart.addSeries(lc.LineSeries, {
    lineWidth: 2,
    priceFormat: dollars,
    title: 'Walk-forward',
  });
  equity.setData(points(data.equity));
  const markers = lc.createSeriesMarkers(equity, []);

  const applyTheme = () => {
    chart.applyOptions({
      layout: { textColor: v('--muted') },
      grid: {
        vertLines: { color: v('--grid') },
        horzLines: { color: v('--grid') },
      },
      rightPriceScale: { borderColor: v('--border') },
      timeScale: { borderColor: v('--border') },
    });
    hold.applyOptions({ color: v('--muted') });
    equity.applyOptions({ color: v('--accent') });
    markers.setMarkers(
      data.windowStarts.map((w) => ({
        time: data.times[w.index] as Charts.UTCTimestamp,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: v('--muted'),
        text: w.label,
      })),
    );
  };
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener(
    'change',
    applyTheme,
  );
  requestAnimationFrame(() => chart.timeScale().fitContent());
}
