import { Badge, Group, Paper, SimpleGrid, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import type { WalkForwardResponse, WalkForwardWindow } from '../../api/types';
import { day, money, pct, tone } from '../../lib/format';
import { StatCard } from './StatCard';

const setting = (w: WalkForwardWindow) =>
  w.chosen
    ? `${w.chosen.strategy} ${Object.entries(w.chosen.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : 'no valid setting';

/**
 * Rough reading of the result: efficiency (unseen ÷ training annual return)
 * says whether the picks kept working, buy & hold whether they were worth it.
 */
function verdict(r: WalkForwardResponse) {
  const e = r.efficiencyPct;
  const hold = r.metrics.buyAndHoldReturnPct;
  const trailed = hold !== null && r.metrics.totalReturnPct < hold;
  if (e === null || e <= 0) return { color: 'red', label: 'did not hold up on unseen data' };
  if (trailed) return { color: 'yellow', label: 'trailed buy & hold' };
  if (e >= 50) return { color: 'teal', label: 'held up and beat buy & hold' };
  return { color: 'yellow', label: 'beat buy & hold, but weaker than in training' };
}

export function WalkForwardSummary({ result }: { result: WalkForwardResponse }) {
  const m = result.metrics;
  const badge = verdict(result);
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>
            Walk-forward: {result.strategies.join(' vs ')} on {result.symbols.join(', ')}
          </Title>
          <Text size="sm" c="dimmed">
            {result.setup} · unseen data {day(result.oosFrom)} → {day(result.oosTo)}
          </Text>
        </div>
        <Tooltip label="Efficiency = annual return on unseen data ÷ annual return in training. Around 50% or more is decent; near 0 means the sweep’s winners were mostly luck. It should also beat buy & hold to be worth it.">
          <Badge variant="light" color={badge.color}>
            {badge.label}
          </Badge>
        </Tooltip>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        <StatCard
          label="Unseen return"
          value={pct(m.totalReturnPct)}
          color={tone(m.totalReturnPct)}
          hint={`Buy & hold ${pct(m.buyAndHoldReturnPct)}`}
        />
        <StatCard
          label="Annualized"
          value={pct(result.outOfSampleAnnualPct)}
          color={tone(result.outOfSampleAnnualPct)}
          hint={`vs ${pct(result.inSampleAnnualPct)} in training`}
        />
        <StatCard
          label="Efficiency"
          value={result.efficiencyPct === null ? 'n/a' : `${result.efficiencyPct.toFixed(0)}%`}
          hint="unseen ÷ training"
        />
        <StatCard
          label="Max drawdown"
          value={pct(-m.maxDrawdownPct, false)}
          color={m.maxDrawdownPct > 0 ? 'red' : undefined}
          hint={`${money(result.initialCash)} → ${money(result.finalEquity)}`}
        />
        <StatCard
          label="Closed trades"
          value={m.trades}
          hint={`win rate ${pct(m.winRatePct, false)}`}
        />
        <StatCard
          label="Settings used"
          value={result.distinctSettings}
          hint={`changed ${result.paramChanges}× in ${result.windows.length} windows`}
        />
      </SimpleGrid>
      <Paper p="sm">
        <Text size="sm" fw={600} mb={4}>
          Windows: picked on training, then traded on unseen data
        </Text>
        <Table.ScrollContainer minWidth={620}>
          <Table verticalSpacing={6} fz="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Picked setting</Table.Th>
                <Table.Th ta="right">Training</Table.Th>
                <Table.Th>Unseen period</Table.Th>
                <Table.Th ta="right">Result</Table.Th>
                <Table.Th ta="right">Buy & hold</Table.Th>
                <Table.Th ta="right">Trades</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.windows.map((w) => (
                <Table.Tr key={w.index}>
                  <Table.Td>{w.index}</Table.Td>
                  <Table.Td>{setting(w)}</Table.Td>
                  <Table.Td ta="right" c={tone(w.chosen?.trainReturnPct)}>
                    {pct(w.chosen?.trainReturnPct)}
                  </Table.Td>
                  <Table.Td>
                    {day(w.testFrom)} → {day(w.testTo)}
                  </Table.Td>
                  <Table.Td ta="right" c={tone(w.test?.returnPct)} fw={600}>
                    {pct(w.test?.returnPct)}
                  </Table.Td>
                  <Table.Td ta="right">{pct(w.test?.buyAndHoldReturnPct)}</Table.Td>
                  <Table.Td ta="right">{w.test?.trades ?? ''}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
