import { Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import type { BrokerHolding } from '../../api/broker-types';
import { money, pct, tone } from '../../lib/format';
import { type HoldingAction, HoldingActions } from './HoldingActions';

const usd = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));
const TONE = { good: 'teal', watch: 'orange', danger: 'red', neutral: 'gray' } as const;

/** One holding: status, prices, its sell levels, and the actions menu. */
export function HoldingRow({
  h,
  onAction,
}: {
  h: BrokerHolding;
  onAction: (action: HoldingAction) => void;
}) {
  return (
    <Table.Tr style={{ cursor: 'pointer' }} onClick={() => onAction('chart')}>
      <Table.Td fw={600}>{h.symbol}</Table.Td>
      <Table.Td>
        <Tooltip label={h.text} multiline w={260} withArrow>
          <Badge variant="light" color={TONE[h.tone]}>
            {h.label}
            {h.rank !== null && h.label !== 'Parked' ? ` · #${h.rank}` : ''}
          </Badge>
        </Tooltip>
      </Table.Td>
      <Table.Td ta="right">{shares(h.qty)}</Table.Td>
      <Table.Td ta="right">
        {usd(h.entryPrice)}
        {h.boughtAt && (
          <Text size="xs" c="dimmed">
            {new Date(h.boughtAt).toLocaleDateString()}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">{usd(h.price)}</Table.Td>
      <Table.Td ta="right" c={tone(h.gainPct)}>
        {pct(h.gainPct)}
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" c="red">
          below {usd(h.stopPrice)}
        </Text>
        {h.takeProfitPrice !== null && (
          <Text size="sm" c="teal">
            above {usd(h.takeProfitPrice)}
          </Text>
        )}
        {(h.stopIsYours || h.takeIsYours) && (
          <Text size="xs" c="dimmed">
            your levels
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        {money(h.value)}
        <Text size="xs" c="dimmed">
          {h.weightPct.toFixed(0)}%
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <HoldingActions holding={h} onAction={onAction} />
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
