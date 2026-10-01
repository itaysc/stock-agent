import { Paper, Table, Text } from '@mantine/core';
import type { DeploymentView } from '../../api/paper-types';
import { money, tone } from '../../lib/format';

/** Each sleeve's holdings, cash, value and closed-trade P&L (plus orders waiting to fill). */
export function SleevesTable({ sleeves }: { sleeves: DeploymentView['sleeves'] }) {
  return (
    <Paper p="md">
      <Text fw={600} size="sm" mb="xs">
        Sleeves and holdings
      </Text>
      <Table.ScrollContainer minWidth={560}>
        <Table fz="sm" verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Sleeve</Table.Th>
              <Table.Th>Holding</Table.Th>
              <Table.Th ta="right">Cash</Table.Th>
              <Table.Th ta="right">Worth now</Table.Th>
              <Table.Th ta="right">Closed-trade P&L</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sleeves.map((s) => (
              <Table.Tr key={s.label}>
                <Table.Td>{s.label}</Table.Td>
                <Table.Td>
                  {s.positions.length
                    ? s.positions
                        .map((p) => `${p.qty} ${p.symbol} @ $${p.avgPrice.toFixed(2)}`)
                        .join(', ')
                    : 'cash only'}
                  {s.staged.length > 0 && (
                    <Text size="xs" c="dimmed">
                      waiting for the news check before the open:{' '}
                      {s.staged.map((b) => `buy ${b.qty} ${b.symbol}`).join(', ')}
                    </Text>
                  )}
                  {s.pending.length > 0 && (
                    <Text size="xs" c="dimmed">
                      waiting to fill:{' '}
                      {s.pending.map((p) => `${p.side} ${p.qty} ${p.symbol}`).join(', ')}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">{money(s.cash)}</Table.Td>
                <Table.Td ta="right">{money(s.equity)}</Table.Td>
                <Table.Td ta="right" c={tone(s.realizedPnl)}>
                  {money(s.realizedPnl)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
