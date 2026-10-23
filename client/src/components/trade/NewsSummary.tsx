import { Alert, Badge, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { NewsSummary as Summary } from '../../api/trade-types';

const MOOD = { positive: 'teal', mixed: 'yellow', negative: 'red', quiet: 'gray' } as const;

/** The AI's summary of the last week's news on a stock (fetched when opened). */
export function NewsSummary({ symbol, onClose }: { symbol: string | null; onClose: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    setError(null);
    if (symbol) void api.tradeNews(symbol).then(setData, (e: Error) => setError(e.message));
  }, [symbol]);
  return (
    <Modal
      opened={!!symbol}
      onClose={onClose}
      title={`${symbol ?? ''}: the news this week`}
      size="lg"
    >
      {error && <Alert color="red">{error}</Alert>}
      {!data && !error && (
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm">Reading the headlines…</Text>
        </Group>
      )}
      {data && (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge color={MOOD[data.mood]} variant="light">
              {data.mood}
            </Badge>
            <Text size="xs" c="dimmed">
              From {data.headlines} headlines since {data.from.slice(0, 10)}
            </Text>
          </Group>
          <Text size="sm">{data.summary}</Text>
          {data.good.length > 0 && (
            <Stack gap={2}>
              <Text size="sm" fw={600} c="teal">
                Good
              </Text>
              {data.good.map((g) => (
                <Text key={g} size="sm">
                  • {g}
                </Text>
              ))}
            </Stack>
          )}
          {data.bad.length > 0 && (
            <Stack gap={2}>
              <Text size="sm" fw={600} c="red">
                Worrying
              </Text>
              {data.bad.map((b) => (
                <Text key={b} size="sm">
                  • {b}
                </Text>
              ))}
            </Stack>
          )}
          <Text size="xs" c="dimmed">
            A summary by AI of recent headlines, not advice. It can miss or misread news.
          </Text>
        </Stack>
      )}
    </Modal>
  );
}
