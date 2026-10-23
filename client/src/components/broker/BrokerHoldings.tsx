import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { lazy, Suspense, useState } from 'react';
import { api } from '../../api/client';
import type { BrokerHolding, BrokerOverview, BrokerPlanned } from '../../api/broker-types';
import type { HoldingAction } from './HoldingActions';
import { useIsMobile } from '../../hooks/useIsMobile';
import { HoldingCard } from './HoldingCard';
import { HoldingRow } from './HoldingRow';
import { LevelsModal } from '../shared/LevelsModal';
import { SellOneModal } from './SellOneModal';
import { SellRules } from './SellRules';

// The chart library is big: load it when a chart is opened.
const StockChart = lazy(() =>
  import('../shared/StockChart').then((m) => ({ default: m.StockChart })),
);
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/** What you're invested in: status, prices, sell levels, a chart, and what you can do with each. */
export function BrokerHoldings({
  investmentId,
  holdings,
  planned,
  params,
  noBuyUntil,
  onOverview,
}: {
  investmentId: string;
  holdings: BrokerHolding[];
  planned: BrokerPlanned[];
  params: Record<string, string>;
  noBuyUntil: Array<{ symbol: string; until: string }>;
  onOverview: (o: BrokerOverview) => void;
}) {
  const mobile = useIsMobile();
  const [chart, setChart] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrokerHolding | null>(null);
  const [selling, setSelling] = useState<BrokerHolding | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (call: () => Promise<BrokerOverview>, done: string) => {
    try {
      onOverview(await call());
      setMessage({ ok: true, text: done });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    }
  };
  const act = (h: BrokerHolding, action: HoldingAction) => {
    if (action === 'chart') return setChart(h.symbol);
    if (action === 'levels') return setEditing(h);
    if (action === 'clear-levels')
      return void run(
        () => api.brokerLevels(investmentId, h.symbol, { stopPrice: null, takeProfitPrice: null }),
        `${h.symbol}: back to the automatic levels.`,
      );
    // Selling it all: choose what takes its place (the next in line, or nothing for now).
    if (action === 'sell-all') return setSelling(h);
    const what = `half of your ${h.symbol} (${shares(h.qty / 2)} shares)`;
    if (
      !window.confirm(
        `Sell ${what} at the market price now (or at the next open if the market is closed)?`,
      )
    )
      return;
    void run(() => api.brokerSell(investmentId, h.symbol, 0.5), `Sell order sent for ${what}.`);
  };
  return (
    // On a phone the cards are the boxes: no frame around them.
    <Paper p={mobile ? 0 : 'md'} withBorder={!mobile} bg={mobile ? 'transparent' : undefined}>
      <Stack gap="sm">
        <Title order={5}>What you're invested in</Title>
        {message && (
          <Alert
            color={message.ok ? 'teal' : 'red'}
            withCloseButton
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}
        {holdings.length && mobile ? (
          <Stack gap="sm">
            {holdings.map((h) => (
              <HoldingCard key={h.symbol} h={h} onAction={(a) => act(h, a)} />
            ))}
          </Stack>
        ) : holdings.length ? (
          <Table.ScrollContainer minWidth={940}>
            <Table verticalSpacing={6} highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {[
                    'Stock',
                    'Status',
                    'Shares',
                    'Bought at',
                    'Now',
                    'Gain',
                    'Since buy',
                    'Sells when',
                    'Value',
                    '',
                  ].map((t, i) => (
                    <Table.Th key={t || i} ta={i >= 2 && i <= 8 && i !== 6 ? 'right' : undefined}>
                      {t}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {holdings.map((h) => (
                  <HoldingRow key={h.symbol} h={h} onAction={(a) => act(h, a)} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Text size="sm" c="dimmed">
            Nothing yet: it buys at the next market open.
          </Text>
        )}
        {planned.length > 0 && (
          <>
            <Title order={6}>Next</Title>
            {planned.map((p, i) => (
              <Text key={i} size="sm">
                {p.side === 'buy' ? '🟢 Buy' : '🔴 Sell'} {shares(p.qty)} {p.symbol} {p.when}
                {p.why && <Text span c="dimmed">{` · ${p.why}`}</Text>}
              </Text>
            ))}
          </>
        )}
        {noBuyUntil.map((b) => (
          <Group key={b.symbol} gap="xs">
            <Text size="sm" c="dimmed">
              You sold {b.symbol}: it won't buy it again until{' '}
              {new Date(b.until).toLocaleDateString()}.
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() =>
                void run(
                  () => api.brokerAllow(investmentId, b.symbol),
                  `It may buy ${b.symbol} again.`,
                )
              }
            >
              Allow now
            </Button>
          </Group>
        ))}
        <SellRules params={params} />
      </Stack>
      <Modal opened={!!chart} onClose={() => setChart(null)} title={chart} size="xl">
        {chart && (
          <Suspense
            fallback={
              <Center h={320}>
                <Loader />
              </Center>
            }
          >
            <StockChart
              symbol={chart}
              load={(range, compare) => api.brokerChart(investmentId, chart, range, compare)}
            />
          </Suspense>
        )}
      </Modal>
      <SellOneModal
        investmentId={investmentId}
        holding={selling}
        onClose={() => setSelling(null)}
        onDone={(o, text) => {
          onOverview(o);
          setMessage({ ok: true, text });
        }}
      />
      <LevelsModal
        holding={
          editing && {
            symbol: editing.symbol,
            price: editing.price,
            entryPrice: editing.entryPrice,
            stopPrice: editing.stopIsYours ? editing.stopPrice : null,
            takeProfitPrice: editing.takeIsYours ? editing.takeProfitPrice : null,
            autoStopPrice: editing.autoStopPrice,
          }
        }
        onClose={() => setEditing(null)}
        onSave={async (levels) => {
          const h = editing as BrokerHolding;
          onOverview(await api.brokerLevels(investmentId, h.symbol, levels));
          setMessage({ ok: true, text: `Saved your levels for ${h.symbol}.` });
        }}
      />
    </Paper>
  );
}
