import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { MyStocksView } from '../../api/trade-types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { money, pct } from '../../lib/format';
import type { LivePrices } from '../../lib/live';
import { Sparkline } from '../shared/Sparkline';
import { StockCard } from '../shared/StockCard';

/** Stocks you're watching: live price, the last 3 months, and a button to trade. */
export function Watchlist({
  view,
  live,
  onTrade,
  onRemove,
  onChart,
}: {
  /** Opens the large chart (clicking the small one). */
  onChart: (symbol: string) => void;
  view: MyStocksView;
  live: LivePrices;
  onTrade: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  const mobile = useIsMobile();
  if (!view.watchlist.length) return null;
  if (mobile)
    return (
      <Stack gap="sm">
        <Title order={5}>Watchlist</Title>
        {view.watchlist.map((w) => {
          const price = live[w.symbol]?.price ?? w.lastClose;
          const first = w.spark[0]?.c;
          return (
            <StockCard
              key={w.symbol}
              symbol={w.symbol}
              price={price ?? null}
              changePct={price && first ? (price / first - 1) * 100 : null}
              changeNote="3 mo"
              spark={w.spark}
              onOpen={() => onChart(w.symbol)}
              actions={
                <>
                  <Button size="sm" variant="light" onClick={() => onTrade(w.symbol)}>
                    Trade
                  </Button>
                  <Button size="sm" variant="default" onClick={() => onRemove(w.symbol)}>
                    Stop watching
                  </Button>
                </>
              }
            />
          );
        })}
      </Stack>
    );
  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Title order={5}>Watchlist</Title>
        <ScrollArea>
          <Table style={{ fontVariantNumeric: 'tabular-nums' }}>
            <Table.Tbody>
              {view.watchlist.map((w) => {
                const price = live[w.symbol]?.price ?? w.lastClose;
                const first = w.spark[0]?.c;
                return (
                  <Table.Tr key={w.symbol}>
                    <Table.Td fw={700}>{w.symbol}</Table.Td>
                    <Table.Td ta="right">{price ? money(price) : '—'}</Table.Td>
                    <Table.Td ta="right" c={price && first && price >= first ? 'teal' : 'red'}>
                      {price && first ? `${pct((price / first - 1) * 100)} in 3 months` : ''}
                    </Table.Td>
                    <Table.Td>
                      <Box
                        style={{ cursor: 'pointer' }}
                        onClick={() => onChart(w.symbol)}
                        title="Open the chart"
                      >
                        <Sparkline points={w.spark} />
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Button size="compact-xs" variant="light" onClick={() => onTrade(w.symbol)}>
                          Trade
                        </Button>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label={`Stop watching ${w.symbol}`}
                          onClick={() => onRemove(w.symbol)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <Text size="xs" c="dimmed">
          Prices update with the page; the small chart is the last 3 months of closes.
        </Text>
      </Stack>
    </Paper>
  );
}
