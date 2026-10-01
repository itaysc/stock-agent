import type * as Charts from 'lightweight-charts';
import type { SweepHtmlData, SweepRunView } from './sweep-html-data.js';

/**
 * Runs in the browser: embedded in the page via `renderSweep.toString()`, so
 * it must not use imports or outer variables.
 */
export function renderSweep(data: SweepHtmlData, lc: typeof Charts): void {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const el = (tag: string, text = '', cls = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const pct = (n: number | null) =>
    n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

  // Sortable table of all runs
  type SortCol =
    | 'rank'
    | 'label'
    | 'returnPct'
    | 'maxDrawdownPct'
    | 'trades'
    | 'winRatePct'
    | 'profitFactor';
  type Col = [SortCol, string, (r: SweepRunView) => string, string];
  const cols: Col[] = [
    ['rank', '#', (r) => String(r.rank), 'num'],
    ['label', 'Strategy / params', (r) => r.label, ''],
    ['returnPct', 'Return', (r) => pct(r.returnPct), 'num'],
    [
      'maxDrawdownPct',
      'Max DD',
      (r) => `-${r.maxDrawdownPct.toFixed(2)}%`,
      'num',
    ],
    ['trades', 'Trades', (r) => String(r.trades), 'num'],
    [
      'winRatePct',
      'Win %',
      (r) => (r.winRatePct === null ? 'n/a' : r.winRatePct.toFixed(0)),
      'num',
    ],
    [
      'profitFactor',
      'PF',
      (r) => (r.profitFactor === null ? 'n/a' : r.profitFactor.toFixed(2)),
      'num',
    ],
  ];
  let sortKey: SortCol = 'rank';
  let ascending = true;
  let selected = 0;
  const renderTable = () => {
    const head = el('tr');
    for (const [key, title, , cls] of cols) {
      const arrow = key === sortKey ? (ascending ? ' ▲' : ' ▼') : '';
      const th = el('th', title + arrow, `sortable ${cls}`);
      th.addEventListener('click', () => {
        ascending =
          key === sortKey
            ? !ascending
            : key === 'rank' || key === 'maxDrawdownPct' || key === 'label';
        sortKey = key;
        renderTable();
      });
      head.append(th);
    }
    const value = (r: SweepRunView) => r[sortKey] ?? -Infinity;
    const rows = [...data.runs].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const cmp =
        typeof x === 'string' && typeof y === 'string'
          ? x.localeCompare(y)
          : Number(x) - Number(y);
      return ascending ? cmp : -cmp;
    });
    const body = el('tbody');
    for (const run of rows) {
      const tr = el('tr', '', run.id === selected ? 'selected' : '');
      tr.dataset.id = String(run.id);
      for (const [key, , format, cls] of cols) {
        const tone =
          key === 'returnPct' ? (run.returnPct >= 0 ? ' gain' : ' loss') : '';
        tr.append(el('td', format(run), cls + tone));
      }
      body.append(tr);
    }
    $('runs').replaceChildren(el('thead'), body);
    ($('runs').firstChild as HTMLElement).append(head);
  };

  // Selecting a run (table row, heatmap cell or dot) shows its report command
  const select = (id: number) => {
    selected = id;
    const run = data.runs.find((r) => r.id === id);
    if (!run) return;
    for (const node of Array.from(document.querySelectorAll('[data-id]'))) {
      node.classList.toggle(
        'selected',
        node.getAttribute('data-id') === String(id),
      );
    }
    $('selected-label').textContent =
      `#${run.rank} ${run.label}: ${pct(run.returnPct)}`;
    $('command').textContent = run.command;
    $('copy').textContent = 'Copy';
  };
  document.addEventListener('click', (event) => {
    const target = (event.target as Element).closest('[data-id]');
    if (target) select(Number(target.getAttribute('data-id')));
  });
  $('copy').addEventListener('click', () => {
    const text = $('command').textContent ?? '';
    const selectText = () => {
      const range = document.createRange();
      range.selectNodeContents($('command'));
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      $('copy').textContent = 'Selected: press ⌘C / Ctrl+C';
    };
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => ($('copy').textContent = 'Copied'), selectText);
    } else selectText();
  });

  // Top equity curves vs buy & hold
  const chart = lc.createChart($('curves-chart'), {
    autoSize: true,
    layout: { background: { color: 'transparent' }, fontFamily: v('--font') },
    timeScale: { minBarSpacing: 0.01 }, // fit long histories on screen
    handleScroll: { mouseWheel: false },
    handleScale: { mouseWheel: false },
  });
  const money = {
    type: 'custom' as const,
    formatter: (p: number) => `$${Math.round(p).toLocaleString('en-US')}`,
  };
  const line = (values: number[]) =>
    values.map((value, i) => ({
      time: data.curves.times[i],
      value,
    })) as unknown as Charts.LineData[];
  const hold = chart.addSeries(lc.LineSeries, {
    lineWidth: 1,
    lineStyle: 2,
    priceFormat: money,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  hold.setData(line(data.curves.buyAndHold));
  const tops = data.curves.top.map((c) => {
    const series = chart.addSeries(lc.LineSeries, {
      lineWidth: 2,
      priceFormat: money,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    series.setData(line(c.values));
    return series;
  });
  const legend = $('curves-legend');
  legend.append(el('span', 'Buy & hold', 'key hold-key'));
  data.curves.top.forEach((c, i) => {
    const key = el('span', `#${i + 1} ${c.label}`, 'key');
    key.style.setProperty('--key', `var(--c${i + 1})`);
    legend.append(key);
  });
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
    tops.forEach((s, i) => s.applyOptions({ color: v(`--c${i + 1}`) }));
  };
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener(
    'change',
    applyTheme,
  );
  // After the first layout: autoSize sets the real width asynchronously.
  requestAnimationFrame(() => chart.timeScale().fitContent());

  renderTable();
  select(0);
}
