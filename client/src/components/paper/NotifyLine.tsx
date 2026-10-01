import { Button, Group, Text } from '@mantine/core';
import { useState } from 'react';
import { api } from '../../api/client';

/** Where alerts go (Telegram / webhook), with a button to send a test message. */
export function NotifyLine({ channels }: { channels: string[] }) {
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const test = async () => {
    setSending(true);
    try {
      const r = await api.testNotification();
      setResult(`Sent to ${r.sentTo.join(' and ')}: check that it arrived.`);
    } catch (err) {
      setResult((err as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <Group gap="xs">
      <Text size="xs" c="dimmed">
        Alerts:{' '}
        {channels.length
          ? `${channels.join(' + ')} ✓`
          : '✗ set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (or NOTIFY_WEBHOOK_URL) in server/.env'}
      </Text>
      {channels.length > 0 && (
        <Button size="compact-xs" variant="default" loading={sending} onClick={() => void test()}>
          Send a test
        </Button>
      )}
      {result && (
        <Text size="xs" c="dimmed">
          {result}
        </Text>
      )}
    </Group>
  );
}
