import { Paper, Stack, Text, Timeline, Title } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight, IconInfoCircle } from '@tabler/icons-react';
import type { BrokerActivity as Item } from '../../api/broker-types';

const ICON = {
  buy: <IconArrowUpRight size={12} />,
  sell: <IconArrowDownRight size={12} />,
  note: <IconInfoCircle size={12} />,
};
const COLOR = { buy: 'teal', sell: 'red', note: 'gray' };

/** What it did, newest first, each with its reason. */
export function BrokerActivity({ items }: { items: Item[] }) {
  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Title order={5}>What it did</Title>
        {items.length ? (
          <Timeline bulletSize={20} lineWidth={2}>
            {items.map((a, i) => (
              <Timeline.Item key={i} bullet={ICON[a.kind]} color={COLOR[a.kind]}>
                <Text size="sm">{a.text}</Text>
                <Text size="xs" c="dimmed">
                  {new Date(a.timestamp).toLocaleString()}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Text size="sm" c="dimmed">
            No trades yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
