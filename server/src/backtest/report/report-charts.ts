import type * as Charts from 'lightweight-charts';
import type { ReportData } from './report-data.js';
import type { ReportHelpers } from './report-helpers.js';

/**
 * Browser-side: equity, drawdown and price charts with synced time ranges.
 * Embedded via toString(), see report-helpers.ts.
 */
export function renderCharts(
  data: ReportData,
  lc: typeof Charts,
  h: ReportHelpers,
): void {
  const { v, $, el, intraday, firstSymbol } = h;
  // Charts are created without colors; applyTheme() colors them from the CSS
  // variables, and runs again when the light/dark preference changes.
  const make = (id: string) =>
    lc.createChart($(id), {
      autoSize: true,
      layout: { background: { color: 'transparent' }, fontFamily: v('--font') },
      // Low minimum bar spacing so long histories fit on screen at once.
      timeScale: { timeVisible: intraday, minBarSpacing: 0.01 },
      crosshair: { mode: 1 },
      // Let the mouse wheel scroll the page; drag to pan, drag an axis to zoom.
      handleScroll: { mouseWheel: false },
      handleScale: { mouseWheel: false },
    });
  const dollars = {
    type: 'custom' as const,
    formatter: (p: number) => `$${Math.round(p).toLocaleString('en-US')}`,
  };
  const equity = make('equity-chart');
  const strategyLine = equity.addSeries(lc.LineSeries, {
    lineWidth: 2,
    title: 'Strategy',
    priceFormat: dollars,
  });
  strategyLine.setData(data.equity as unknown as Charts.LineData[]);
  const holdLine = equity.addSeries(lc.LineSeries, {
    lineWidth: 1,
    lineStyle: 2,
    title: 'Buy & hold',
    priceFormat: dollars,
  });
  holdLine.setData(data.buyAndHold as unknown as Charts.LineData[]);

  const drawdown = make('drawdown-chart');
  const drawdownArea = drawdown.addSeries(lc.BaselineSeries, {
    baseValue: { type: 'price', price: 0 },
    priceFormat: {
      type: 'custom',
      formatter: (p: number) => `${p.toFixed(1)}%`,
    },
  });
  drawdownArea.setData(data.drawdown as unknown as Charts.BaselineData[]);

  const price = make('price-chart');
  const candles = price.addSeries(lc.CandlestickSeries, {
    borderVisible: false,
  });
  const markers = lc.createSeriesMarkers(candles, []);
  let current = firstSymbol;
  const show = (symbol: string) => {
    current = symbol;
    candles.setData(
      data.candles[symbol] as unknown as Charts.CandlestickData[],
    );
    markers.setMarkers(
      data.fills
        .filter((f) => f.symbol === symbol)
        .map((f) => ({
          time: f.time as Charts.UTCTimestamp,
          position: f.side === 'buy' ? 'belowBar' : 'aboveBar',
          shape: f.side === 'buy' ? 'arrowUp' : 'arrowDown',
          color: f.side === 'buy' ? v('--gain') : v('--loss'),
        })),
    );
    for (const tab of Array.from($('tabs').children)) {
      tab.classList.toggle('active', tab.textContent === symbol);
    }
  };
  for (const symbol of data.symbols) {
    const tab = el('button', symbol, 'tab');
    tab.addEventListener('click', () => show(symbol));
    $('tabs').append(tab);
  }

  const all = [equity, drawdown, price];
  const applyTheme = () => {
    for (const chart of all) {
      chart.applyOptions({
        layout: { textColor: v('--muted') },
        grid: {
          vertLines: { color: v('--grid') },
          horzLines: { color: v('--grid') },
        },
        rightPriceScale: { borderColor: v('--border') },
        timeScale: { borderColor: v('--border') },
      });
    }
    strategyLine.applyOptions({ color: v('--accent') });
    holdLine.applyOptions({ color: v('--muted') });
    drawdownArea.applyOptions({
      topLineColor: v('--loss'),
      bottomLineColor: v('--loss'),
      bottomFillColor1: v('--loss-soft'),
      bottomFillColor2: v('--loss-soft'),
    });
    candles.applyOptions({
      upColor: v('--gain'),
      downColor: v('--loss'),
      wickUpColor: v('--gain'),
      wickDownColor: v('--loss'),
    });
    show(current); // marker colors
  };
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener(
    'change',
    applyTheme,
  );

  let syncing = false;
  for (const chart of all) {
    // After the first layout: autoSize sets the real width asynchronously.
    requestAnimationFrame(() => chart.timeScale().fitContent());
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (syncing || !range) return;
      syncing = true;
      for (const other of all) {
        if (other !== chart) {
          try {
            other.timeScale().setVisibleRange(range);
          } catch {
            /* no data in range */
          }
        }
      }
      syncing = false;
    });
  }
}
