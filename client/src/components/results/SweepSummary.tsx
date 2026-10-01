import { Badge, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { SweepResponse } from '../../api/types';
import { day, pct, tone } from '../../lib/format';
import { StatCard } from './StatCard';

export function SweepSummary({ result }: { result: SweepResponse }) {
  const strategies = result.summaries.map((s) => s.strategy).join(' vs ');
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>
            Sweep: {strategies} on {result.symbols.join(', ')}
          </Title>
          <Text size="sm" c="dimmed">
            {day(result.from)} → {day(result.to)} · {result.bars} bars · {result.runs} runs
            {result.skipped ? ` · ${result.skipped} invalid skipped` : ''}
            {result.hidden ? ` · ${result.hidden} hidden (min trades)` : ''}
          </Text>
        </div>
        <Badge variant="light" color="gray">
          Buy & hold {pct(result.buyAndHoldReturnPct)}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: Math.min(result.summaries.length, 3) }} spacing="sm">
        {result.summaries.map((s) => (
          <StatCard
            key={s.strategy}
            label={s.strategy}
            value={pct(s.medianReturnPct)}
            color={tone(s.medianReturnPct)}
            hint={`median of ${s.runs} · best ${pct(s.bestReturnPct)} · ${s.positive}/${s.runs} positive · ${s.beatHold}/${s.runs} beat buy & hold`}
          />
        ))}
      </SimpleGrid>
      {result.top.length > 0 && (
        <Paper p="sm">
          <Text size="sm" fw={600} mb={4}>
            Top runs
          </Text>
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing={6} fz="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Strategy / params</Table.Th>
                  <Table.Th ta="right">Return</Table.Th>
                  <Table.Th ta="right">Max DD</Table.Th>
                  <Table.Th ta="right">Trades</Table.Th>
                  <Table.Th ta="right">PF</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.top.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>{r.rank}</Table.Td>
                    <Table.Td>
                      {r.label}
                      {r.beatHold && (
                        <Badge size="xs" ml={6} color="teal" variant="light">
                          beat B&H
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td ta="right" c={tone(r.returnPct)}>
                      {pct(r.returnPct)}
                    </Table.Td>
                    <Table.Td ta="right">-{r.maxDrawdownPct.toFixed(2)}%</Table.Td>
                    <Table.Td ta="right">{r.trades}</Table.Td>
                    <Table.Td ta="right">{r.profitFactor?.toFixed(2) ?? 'n/a'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  );
}
