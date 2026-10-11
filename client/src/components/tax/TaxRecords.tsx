import { Button, Paper, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { TaxRecord } from '../../api/tax-types';
import { money, shekels } from '../../lib/format';

const KIND: Record<TaxRecord['kind'], string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  tax_withheld: 'Tax withheld',
  interest: 'Interest',
  fee: 'Fee',
  transfer: 'Transfer',
  other: 'Other',
};

/** Every stored activity of the year, as copied from the broker (shown on request). */
export function TaxRecords({ year, paper }: { year: number; paper: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TaxRecord[] | null>(null);
  useEffect(() => {
    if (open) void api.taxRecords(year, paper).then(setRows);
  }, [open, year, paper]);

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Title order={5}>All activity</Title>
        {!open ? (
          <Button size="xs" variant="default" w="fit-content" onClick={() => setOpen(true)}>
            Show every buy, sell, fee and transfer
          </Button>
        ) : !rows ? (
          <Text size="sm">Loading…</Text>
        ) : rows.length ? (
          <ScrollArea h={rows.length > 15 ? 420 : undefined}>
            <Table striped fz="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Day</Table.Th>
                  <Table.Th>What</Table.Th>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th ta="right">Shares</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th ta="right">Rate (day)</Table.Th>
                  <Table.Th ta="right">Amount ₪</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.activityId}>
                    <Table.Td>{r.day}</Table.Td>
                    <Table.Td title={r.description ?? r.activityType}>{KIND[r.kind]}</Table.Td>
                    <Table.Td>{r.symbol ?? ''}</Table.Td>
                    <Table.Td ta="right">{r.qty?.toFixed(4) ?? ''}</Table.Td>
                    <Table.Td ta="right">{r.priceUsd ? money(r.priceUsd) : ''}</Table.Td>
                    <Table.Td ta="right">{money(r.amountUsd)}</Table.Td>
                    <Table.Td ta="right" title={`Bank of Israel rate of ${r.rateDate}`}>
                      {r.usdIls.toFixed(3)}
                      {r.rateDate !== r.day ? ` (${r.rateDate.slice(5)})` : ''}
                    </Table.Td>
                    <Table.Td ta="right">{shekels(r.amountIls)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">
            Nothing recorded for {year} ({paper ? 'paper' : 'real money'}).
          </Text>
        )}
        <Text size="xs" c="dimmed">
          The account number and the broker&apos;s own id are kept with each record. Amounts are as
          the broker reported them; the rate is the Bank of Israel representative rate of that day
          (or the last one before it).
        </Text>
      </Stack>
    </Paper>
  );
}
