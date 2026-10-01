import { Table, Text } from '@mantine/core';
import type { BrokerPlan } from '../../api/broker-types';
import { money } from '../../lib/format';

const price = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/** The suggested spread of the money: what, how much, and why. */
export function BrokerPlanTable({ plan }: { plan: BrokerPlan }) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table verticalSpacing={6}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Stock</Table.Th>
            <Table.Th ta="right">Share</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th ta="right">Shares</Table.Th>
            <Table.Th ta="right">Price now</Table.Th>
            <Table.Th ta="right">First stop</Table.Th>
            <Table.Th>Why</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {plan.rows.map((r) => (
            <Table.Tr key={r.symbol}>
              <Table.Td fw={600}>{r.symbol}</Table.Td>
              <Table.Td ta="right">{r.weightPct.toFixed(0)}%</Table.Td>
              <Table.Td ta="right">{money(r.amount)}</Table.Td>
              <Table.Td ta="right">{shares(r.qty)}</Table.Td>
              <Table.Td ta="right">{price(r.price)}</Table.Td>
              <Table.Td ta="right" c="red">
                {price(r.stopPrice)}
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {r.why}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
