import { Alert, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { IconShieldExclamation } from '@tabler/icons-react';
import type { PortfolioResponse } from '../../api/types';
import { day, money, pct, tone } from '../../lib/format';

/** Plain words for the average correlation of the sleeves' daily moves. */
function diversification(correlation: Array<Array<number | null>>): string | null {
  const pairs = correlation
    .flatMap((row, i) => row.slice(i + 1))
    .filter((c): c is number => c !== null);
  if (pairs.length === 0) return null;
  const avg = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  const how =
    avg < 0.3
      ? 'move mostly independently: good diversification, one bad sleeve rarely drags the others down'
      : avg < 0.6
        ? 'move somewhat alike: some diversification'
        : 'move very alike: little diversification, they tend to win and lose together';
  return `The sleeves ${how} (average correlation ${avg.toFixed(2)}, where 1 = identical).`;
}

export function PortfolioSummary({ result }: { result: PortfolioResponse }) {
  const div = diversification(result.correlation);
  return (
    <Stack gap="sm">
      <div>
        <Title order={3}>Portfolio: {result.sleeves.length} sleeves</Title>
        <Text size="sm" c="dimmed">
          {day(result.from)} → {day(result.to)} · compared with putting each sleeve&apos;s money in
          its own symbols and holding
          {result.reserve.allocated > 0
            ? `, and ${money(result.reserve.allocated)} kept in cash`
            : ''}
        </Text>
      </div>
      <Paper p="sm">
        <Table.ScrollContainer minWidth={620}>
          <Table verticalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sleeve</Table.Th>
                <Table.Th ta="right">Put in</Table.Th>
                <Table.Th ta="right">Ended with</Table.Th>
                <Table.Th ta="right">Made / lost</Table.Th>
                <Table.Th ta="right">Holding would</Table.Th>
                <Table.Th ta="right">Worst drop</Table.Th>
                <Table.Th ta="right">Trades</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.sleeves.map((s) => (
                <Table.Tr key={s.label}>
                  <Table.Td>{s.label}</Table.Td>
                  <Table.Td ta="right">{money(s.allocated)}</Table.Td>
                  <Table.Td ta="right">{money(s.finalEquity)}</Table.Td>
                  <Table.Td ta="right" c={tone(s.contribution)} fw={600}>
                    {s.contribution >= 0 ? '+' : '−'}
                    {money(Math.abs(s.contribution))}
                  </Table.Td>
                  <Table.Td ta="right">{pct(s.holdReturnPct)}</Table.Td>
                  <Table.Td ta="right">−{s.maxDrawdownPct.toFixed(1)}%</Table.Td>
                  <Table.Td ta="right">{s.trades}</Table.Td>
                </Table.Tr>
              ))}
              {result.reserve.allocated > 0 && (
                <Table.Tr>
                  <Table.Td c="dimmed">Cash reserve (earns interest)</Table.Td>
                  <Table.Td ta="right">{money(result.reserve.allocated)}</Table.Td>
                  <Table.Td ta="right">{money(result.reserve.final)}</Table.Td>
                  <Table.Td ta="right" c="teal">
                    +{money(result.reserve.final - result.reserve.allocated)}
                  </Table.Td>
                  <Table.Td colSpan={3} />
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
      {div && (
        <Text size="sm" c="dimmed">
          {div}
        </Text>
      )}
      {result.risk.maxDrawdownPct > 0 && (
        <Alert
          variant="light"
          color={result.stops.length ? 'orange' : 'gray'}
          icon={<IconShieldExclamation />}
          title="Portfolio stop"
        >
          {result.stops.length === 0
            ? `Never triggered: the portfolio never fell ${result.risk.maxDrawdownPct}% below its peak.`
            : result.stops
                .map(
                  (s) =>
                    `${day(s.timestamp)}: down ${s.drawdownPct.toFixed(1)}%, sold everything, buying again from ${day(s.resumesAt)}.`,
                )
                .join(' ')}
        </Alert>
      )}
    </Stack>
  );
}
