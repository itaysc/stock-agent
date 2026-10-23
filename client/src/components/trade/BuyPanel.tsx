import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconEye, IconNews } from '@tabler/icons-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { MyStocksView, Quote } from '../../api/trade-types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { money } from '../../lib/format';
import { StickyAction } from '../shared/StickyAction';
import { AmountPicker } from './AmountPicker';

const StockChart = lazy(() =>
  import('../shared/StockChart').then((m) => ({ default: m.StockChart })),
);
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/** One stock: its price and chart, and buying or selling a dollar amount of it (with a confirm step). */
export function BuyPanel({
  symbol,
  free,
  watching,
  onChanged,
  onNews,
  onWatch,
}: {
  symbol: string;
  free: number | null;
  watching: boolean;
  onChanged: (v: MyStocksView, message: string) => void;
  onNews: (symbol: string) => void;
  onWatch: (symbol: string) => void;
}) {
  const mobile = useIsMobile();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [amount, setAmount] = useState<number | ''>(100);
  const [confirm, setConfirm] = useState<'buy' | 'sell' | 'sell-all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setQuote(null);
    setConfirm(null);
    setError(null);
    void api.tradeQuote(symbol).then(setQuote, (e: Error) => setError(e.message));
  }, [symbol]);

  const price = quote?.price ?? null;
  const mine = quote?.mine ?? null;
  const n = amount === '' ? 0 : amount;
  const about = price ? n / price : null;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const v =
        confirm === 'buy'
          ? await api.tradeBuy(symbol, n)
          : await api.tradeSell(symbol, confirm === 'sell' ? n : undefined);
      onChanged(
        v,
        `Sent: ${confirm === 'buy' ? 'buy' : 'sell'} ${symbol}. It fills now, or at the next open when the market is closed.`,
      );
      setConfirm(null);
      setQuote(await api.tradeQuote(symbol));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const what =
    confirm === 'buy'
      ? `Buy ${money(n)} of ${symbol}${about ? ` (about ${shares(about)} shares at ${money(price as number)})` : ''}?`
      : confirm === 'sell'
        ? `Sell about ${money(n)} of your ${symbol}?`
        : `Sell all your ${mine ? shares(mine.qty) : ''} ${symbol}?`;
  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Group gap="sm" align="baseline">
              <Title order={4}>{symbol}</Title>
              {mobile && <Text fw={700}>{price ? money(price) : '—'}</Text>}
            </Group>
            <Text size="sm" c="dimmed">
              {quote?.asset?.name ?? (quote ? 'Not tradable on Alpaca' : 'Loading…')}
            </Text>
          </div>
          <Group gap="xs" grow={mobile} w={mobile ? '100%' : undefined}>
            {!mobile && <Text fw={700}>{price ? money(price) : '—'}</Text>}
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant="light"
              leftSection={<IconNews size={14} />}
              onClick={() => onNews(symbol)}
            >
              News summary
            </Button>
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant="default"
              leftSection={<IconEye size={14} />}
              disabled={watching}
              onClick={() => onWatch(symbol)}
            >
              {watching ? 'Watching' : 'Watch'}
            </Button>
          </Group>
        </Group>
        {quote?.earnings?.soon && (
          <Alert color="orange" p="xs">
            Reports earnings on {quote.earnings.date} ({quote.earnings.inDays} days): the price can
            jump either way then.
          </Alert>
        )}
        <Group gap="lg">
          {mine && (
            <Text size="sm">
              You hold <b>{shares(mine.qty)}</b> (bought at {money(mine.avgPrice)})
            </Text>
          )}
          {!!quote?.brokerQty && (
            <Text size="sm" c="dimmed">
              Your broker investments hold {shares(quote.brokerQty)} more (not sold from here).
            </Text>
          )}
          {free !== null && (
            <Text size="sm" c="dimmed">
              Free to invest: {money(free)}
            </Text>
          )}
        </Group>
        <AmountPicker amount={amount} free={free} onChange={setAmount} />
        {/* On a phone the order buttons (and then the confirm step) stick above the tab bar. */}
        {mobile && confirm ? (
          <StickyAction note={what}>
            <Button size="md" variant="default" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              size="md"
              color={confirm === 'buy' ? 'teal' : 'red'}
              loading={busy}
              onClick={() => void go()}
            >
              Confirm
            </Button>
          </StickyAction>
        ) : (
          <StickyAction>
            <Button
              color="teal"
              size={mobile ? 'md' : 'sm'}
              disabled={!quote?.asset || !n}
              onClick={() => setConfirm('buy')}
            >
              Buy
            </Button>
            <Button
              color="red"
              variant="light"
              size={mobile ? 'md' : 'sm'}
              disabled={!mine || !n}
              onClick={() => setConfirm('sell')}
            >
              Sell
            </Button>
            <Button
              color="red"
              variant="subtle"
              size={mobile ? 'md' : 'sm'}
              disabled={!mine}
              onClick={() => setConfirm('sell-all')}
            >
              Sell all
            </Button>
          </StickyAction>
        )}
        {confirm && !mobile && (
          <Alert color={confirm === 'buy' ? 'teal' : 'red'} p="xs">
            <Group justify="space-between">
              <Text size="sm">{what} A market order on the paper account.</Text>
              <Group gap="xs">
                <Button size="xs" variant="default" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button size="xs" loading={busy} onClick={() => void go()}>
                  Confirm
                </Button>
              </Group>
            </Group>
          </Alert>
        )}
        {error && <Alert color="red">{error}</Alert>}
        <Suspense fallback={null}>
          <StockChart
            key={symbol}
            symbol={symbol}
            initialRange="1y"
            sinceBuy={!!mine}
            load={(range, compare) => api.tradeChart(symbol, range, compare)}
          />
        </Suspense>
      </Stack>
    </Paper>
  );
}
