import { Alert, Center, Loader, Modal, Stack } from '@mantine/core';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { MyPosition, MyStocksView } from '../../api/trade-types';
import { useLivePrices } from '../../hooks/useLivePrices';
import { DataTimes } from '../shared/DataTimes';
import { LevelsModal } from '../shared/LevelsModal';
import { BuyPanel } from './BuyPanel';
import { Discovery } from './Discovery';
import { type MyAction, MyStocksTable } from './MyStocksTable';
import { NewsSummary } from './NewsSummary';
import { TickerSearch } from './TickerSearch';
import { Watchlist } from './Watchlist';
import { syncSummary } from '../../lib/sync';

const StockChart = lazy(() =>
  import('../shared/StockChart').then((m) => ({ default: m.StockChart })),
);
/** Your stocks and orders reload every minute; live prices every 3 minutes. */
const PAGE_MS = 60_000;
const LIVE_MS = 3 * 60_000;

/** Trade stocks yourself (paper account): search, chart, buy and sell, your stocks, watchlist and discovery. */
export function TradePage() {
  const [view, setView] = useState<MyStocksView | null>(null);
  const [free, setFree] = useState<number | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [chart, setChart] = useState<string | null>(null);
  const [news, setNews] = useState<string | null>(null);
  const [editing, setEditing] = useState<MyPosition | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [round, setRound] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    try {
      const [v, a] = await Promise.all([api.myStocks(), api.paperAccount()]);
      setView(v);
      setFree(a.free);
      setLoadedAt(new Date());
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), PAGE_MS);
    return () => clearInterval(t);
  }, [load, round]);
  const symbols = [
    ...(view?.positions.map((p) => p.symbol) ?? []),
    ...(view?.watchlist.map((w) => w.symbol) ?? []),
  ];
  const live = useLivePrices(symbols, LIVE_MS, round);

  const changed = (v: MyStocksView, text: string) => {
    setView(v);
    setMessage({ ok: true, text });
    void api.paperAccount().then(
      (a) => setFree(a.free),
      () => undefined,
    );
  };
  const fail = (e: unknown) => setMessage({ ok: false, text: (e as Error).message });
  const watch = (s: string) =>
    void api
      .tradeWatchlist([...(view?.watchlist.map((w) => w.symbol) ?? []), s])
      .then((v) => changed(v, `Watching ${s}.`), fail);
  const unwatch = (s: string) =>
    void api
      .tradeWatchlist((view?.watchlist.map((w) => w.symbol) ?? []).filter((x) => x !== s))
      .then(setView, fail);
  const sync = async () => {
    setSyncing(true);
    try {
      const { result, view: v } = await api.tradeSync();
      changed(v, syncSummary(result));
    } catch (e) {
      fail(e);
    } finally {
      setSyncing(false);
    }
  };
  const pick = (s: string) => {
    setSymbol(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const act = (p: MyPosition, a: MyAction) => {
    if (a === 'trade') pick(p.symbol);
    else if (a === 'chart') setChart(p.symbol);
    else if (a === 'levels') setEditing(p);
    else if (window.confirm(`Sell all your ${p.qty} ${p.symbol} at market?`))
      void api.tradeSell(p.symbol).then((v) => changed(v, `Sent: sell all ${p.symbol}.`), fail);
  };

  if (!view)
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  const watching = view.watchlist.map((w) => w.symbol);
  return (
    <Stack gap="lg">
      {message && (
        <Alert color={message.ok ? 'teal' : 'red'} withCloseButton onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      <TickerSearch onPick={pick} />
      {symbol && (
        <BuyPanel
          symbol={symbol}
          free={free}
          watching={watching.includes(symbol)}
          onChanged={changed}
          onNews={setNews}
          onWatch={watch}
        />
      )}
      <DataTimes
        closesAsOf={null}
        liveTradeAt={
          Object.values(live.prices)
            .map((p) => p.at)
            .sort()
            .at(-1) ?? null
        }
        liveCheckedAt={live.checkedAt}
        pageAt={loadedAt}
        nextPageAt={loadedAt && new Date(loadedAt.getTime() + PAGE_MS)}
        nextLiveAt={live.nextAt}
        onRefresh={() => setRound((r) => r + 1)}
      />
      <MyStocksTable
        view={view}
        live={live.prices}
        onAction={act}
        onSync={() => void sync()}
        syncing={syncing}
      />
      <Watchlist
        onChart={setChart}
        view={view}
        live={live.prices}
        onTrade={pick}
        onRemove={unwatch}
      />
      <Discovery
        onChart={setChart}
        onTrade={pick}
        onWatch={watch}
        onNews={setNews}
        watching={watching}
      />
      <NewsSummary symbol={news} onClose={() => setNews(null)} />
      <Modal opened={!!chart} onClose={() => setChart(null)} size="xl" title={chart}>
        <Suspense fallback={<Loader />}>
          {chart && (
            <StockChart
              symbol={chart}
              // A stock you hold opens since the buy; any other on the last year.
              initialRange={view.positions.some((p) => p.symbol === chart) ? 'buy' : '1y'}
              sinceBuy={view.positions.some((p) => p.symbol === chart)}
              load={(range, compare) => api.tradeChart(chart, range, compare)}
            />
          )}
        </Suspense>
      </Modal>
      <LevelsModal
        holding={
          editing && {
            symbol: editing.symbol,
            price: live.prices[editing.symbol]?.price ?? editing.lastClose ?? editing.avgPrice,
            entryPrice: editing.avgPrice,
            stopPrice: editing.levels?.stopPrice ?? null,
            takeProfitPrice: editing.levels?.takeProfitPrice ?? null,
          }
        }
        onClose={() => setEditing(null)}
        onSave={async (levels) => {
          const s = (editing as MyPosition).symbol;
          changed(await api.tradeLevels(s, levels), `Saved your levels for ${s}.`);
        }}
      />
    </Stack>
  );
}
