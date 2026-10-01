import { Badge, Group, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core';
import type { BacktestResponse, HistoryStatus } from '../../api/types';
import { day, money, pct, tone } from '../../lib/format';
import { StatCard } from './StatCard';

function HistoryBadge({ status }: { status: HistoryStatus }) {
  switch (status.kind) {
    case 'new':
      return <Badge variant="light">New · saved to history</Badge>;
    case 'reused':
      return (
        <Tooltip label="Same test, same versions and data: result and AI summary reused">
          <Badge variant="light" color="gray">
            Reused · saved {new Date(status.savedAt).toLocaleString()}
          </Badge>
        </Tooltip>
      );
    case 'replaced':
      return (
        <Badge variant="light" color="orange">
          Re-ran · saved run was stale ({status.reason})
        </Badge>
      );
    case 'forced':
      return (
        <Badge variant="light" color="violet">
          Re-ran (fresh)
        </Badge>
      );
  }
}

export function BacktestSummary({ result }: { result: BacktestResponse }) {
  const m = result.metrics;
  const open = result.openPositions.map((p) => `${p.qty} ${p.symbol}`).join(', ');
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>
            {result.strategy} on {result.symbols.join(', ')}
          </Title>
          <Text size="sm" c="dimmed">
            {day(result.from)} → {day(result.to)} · {result.bars} bars
          </Text>
        </div>
        <HistoryBadge status={result.history} />
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        <StatCard
          label="Return"
          value={pct(m.totalReturnPct)}
          color={tone(m.totalReturnPct)}
          hint={`Buy & hold ${pct(m.buyAndHoldReturnPct)}`}
        />
        <StatCard
          label="Final equity"
          value={money(result.finalEquity)}
          hint={`from ${money(result.initialCash)}`}
        />
        <StatCard
          label="Max drawdown"
          value={pct(-m.maxDrawdownPct, false)}
          color={m.maxDrawdownPct > 0 ? 'red' : undefined}
          hint="worst fall from a peak"
        />
        <StatCard
          label="Closed trades"
          value={m.trades}
          hint={`win rate ${pct(m.winRatePct, false)}`}
        />
        <StatCard
          label="Profit factor"
          value={m.profitFactor === null ? 'n/a' : m.profitFactor.toFixed(2)}
          hint="gross profit ÷ loss"
        />
        <StatCard
          label="Still open"
          value={open || 'none'}
          hint={result.rejections ? `${result.rejections} orders rejected` : 'no rejected orders'}
        />
      </SimpleGrid>
    </Stack>
  );
}
