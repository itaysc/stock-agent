import { Group, Paper, Text } from '@mantine/core';
import type { PaperAccount } from '../../api/paper-types';
import { money } from '../../lib/format';

/** Where your paper money is: invested, waiting to be invested, and free to invest. */
export function FundsLine({ account }: { account: PaperAccount }) {
  const item = (label: string, value: number, hint: string, color?: string) => (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={700} c={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {money(value)}
      </Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    </div>
  );
  return (
    <Paper p="sm" withBorder>
      <Group justify="space-between" wrap="wrap" gap="lg">
        {item('Account', account.equity, 'cash and stocks, all of it')}
        {item('Invested', account.invested, 'in stocks now')}
        {item(
          'Waiting to invest',
          account.reserved,
          'given to the broker, bought at the next open or re-check',
        )}
        {item('Free to invest', account.free, 'not given to any investment', 'teal')}
      </Group>
    </Paper>
  );
}
