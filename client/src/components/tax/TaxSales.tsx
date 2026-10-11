import { Paper, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import type { TaxHolding, TaxSale } from '../../api/tax-types';
import { money, shekels } from '../../lib/format';

const color = (n: number) => (n >= 0 ? 'teal' : 'red');

/** The year's sales, each matched to its buys (first in, first out), and what was still held at the end. */
export function TaxSales({
  sales,
  holdings,
  valuedOn,
}: {
  sales: TaxSale[];
  holdings: TaxHolding[];
  valuedOn: string;
}) {
  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Title order={5}>Sales</Title>
        {sales.length ? (
          <ScrollArea>
            <Table striped fz="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th>Bought</Table.Th>
                  <Table.Th>Sold</Table.Th>
                  <Table.Th ta="right">Shares</Table.Th>
                  <Table.Th ta="right">Cost</Table.Th>
                  <Table.Th ta="right">Sold for</Table.Th>
                  <Table.Th ta="right">Gain $</Table.Th>
                  <Table.Th ta="right">Cost ₪</Table.Th>
                  <Table.Th ta="right">Sold for ₪</Table.Th>
                  <Table.Th ta="right">Rate</Table.Th>
                  <Table.Th ta="right" title="The dollar gain at the sale day's rate">
                    Gain ₪
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sales.map((s, i) => (
                  <Table.Tr key={i}>
                    <Table.Td fw={600}>{s.symbol}</Table.Td>
                    <Table.Td>{s.boughtOn.join(', ') || '?'}</Table.Td>
                    <Table.Td>{s.soldOn}</Table.Td>
                    <Table.Td ta="right">{s.qty.toFixed(4)}</Table.Td>
                    <Table.Td ta="right">{money(s.costUsd)}</Table.Td>
                    <Table.Td ta="right">{money(s.proceedsUsd)}</Table.Td>
                    <Table.Td ta="right" c={color(s.gainUsd)}>
                      {money(s.gainUsd)}
                    </Table.Td>
                    <Table.Td ta="right">{shekels(s.costIls)}</Table.Td>
                    <Table.Td ta="right">{shekels(s.proceedsIls)}</Table.Td>
                    <Table.Td ta="right">{s.saleRate.toFixed(3)}</Table.Td>
                    <Table.Td ta="right" c={color(s.realGainIls)}>
                      {shekels(s.realGainIls)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">
            No sales this year.
          </Text>
        )}
        <Title order={6}>Still held on {valuedOn}</Title>
        {holdings.length ? (
          <ScrollArea>
            <Table fz="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th ta="right">Shares</Table.Th>
                  <Table.Th ta="right">Cost</Table.Th>
                  <Table.Th ta="right">Cost ₪</Table.Th>
                  <Table.Th ta="right">Worth</Table.Th>
                  <Table.Th ta="right">Worth ₪</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {holdings.map((h) => (
                  <Table.Tr key={h.symbol}>
                    <Table.Td fw={600}>{h.symbol}</Table.Td>
                    <Table.Td ta="right">{h.qty.toFixed(4)}</Table.Td>
                    <Table.Td ta="right">{money(h.costUsd)}</Table.Td>
                    <Table.Td ta="right">{shekels(h.costIls)}</Table.Td>
                    <Table.Td ta="right">{h.valueUsd === null ? '?' : money(h.valueUsd)}</Table.Td>
                    <Table.Td ta="right">
                      {h.valueIls === null ? '?' : shekels(h.valueIls)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">
            Nothing held.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
