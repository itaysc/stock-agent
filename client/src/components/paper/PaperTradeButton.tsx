import { Button, Group, Text } from '@mantine/core';
import { IconRocket } from '@tabler/icons-react';

/** "Paper trade this": try the shown setup with fake money on the paper account. */
export function PaperTradeButton({ onClick, note }: { onClick: () => void; note?: string }) {
  return (
    <Group justify="space-between" gap="sm">
      <Text size="xs" c="dimmed">
        {note ?? 'Try it with fake money: it trades your Alpaca paper account day by day.'}
      </Text>
      <Button size="xs" variant="light" leftSection={<IconRocket size={14} />} onClick={onClick}>
        Paper trade this
      </Button>
    </Group>
  );
}
