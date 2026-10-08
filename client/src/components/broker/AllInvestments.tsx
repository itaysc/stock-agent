import { Badge, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { InvestmentView } from '../../api/broker-types';
import { cashShown, money, pct, tone } from '../../lib/format';
import { StatCard } from '../results/StatCard';
import { combineDays } from '../../lib/daily';
import { STATUS } from './InvestmentPanel';
import { MonthCalendar } from './MonthCalendar';

const HEAD = ['Investment', 'Since', 'Put in', 'Worth now', 'Gain', 'SPY, same time', 'Holds'];

/** Every investment together: the totals, and one row each (click to open it). */
export function AllInvestments({
  list,
  onOpen,
}: {
  list: InvestmentView[];
  onOpen: (id: string) => void;
}) {
  const capital = list.reduce((n, v) => n + v.capital, 0);
  const equity = list.reduce((n, v) => n + v.equity, 0);
  const gain = equity - capital;
  const gainPct = capital ? (gain / capital) * 100 : 0;
  const running = list.filter((v) => v.status === 'active').length;
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard label="Worth now" value={money(equity)} hint={`put in ${money(capital)}`} />
        <StatCard label="Gain" value={pct(gainPct)} color={tone(gainPct)} hint={money(gain)} />
        <StatCard
          label="Investments"
          value={list.length}
          hint={running === list.length ? 'all trading' : `${running} trading`}
        />
        <StatCard
          label="Cash in them"
          {...cashShown(
            list.reduce((n, v) => n + v.cash, 0),
            list.reduce((n, v) => n + v.holdings.length, 0),
          )}
        />
      </SimpleGrid>
      <Paper p="md" withBorder>
        <Title order={5} mb="xs">
          Your investments
        </Title>
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing={8} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {HEAD.map((t, i) => (
                  <Table.Th key={t} ta={i >= 2 && i <= 5 ? 'right' : undefined}>
                    {t}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((v) => (
                <Table.Tr
                  key={v.deploymentId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(v.deploymentId)}
                  title="Open this investment"
                >
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={600}>
                        {v.name}
                      </Text>
                      <Badge size="xs" variant="light" color={STATUS[v.status].color}>
                        {STATUS[v.status].label}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(v.startedAt).toLocaleDateString()}</Text>
                  </Table.Td>
                  <Table.Td ta="right">{money(v.capital)}</Table.Td>
                  <Table.Td ta="right">{money(v.equity)}</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c={tone(v.pnlPct)}>
                      {pct(v.pnlPct)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed">
                      {pct(v.spyPct)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {v.holdings.map((h) => h.symbol).join(' ') || 'cash'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
      <MonthCalendar
        days={combineDays(list.map((v) => v.daily ?? []))}
        title="Day by day, all investments"
      />
    </Stack>
  );
}
