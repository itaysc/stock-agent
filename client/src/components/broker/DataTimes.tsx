import { Button, Group, Text } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { tradingDay, when } from '../../lib/when';

/** "0:42": the time left until `at` (0:00 once it has passed). */
const left = (at: Date, now: number) => {
  const s = Math.max(0, Math.round((at.getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Where the page's numbers come from, how fresh they are, when they update next, and a button to update now. */
export function DataTimes({
  closesAsOf,
  liveTradeAt,
  liveCheckedAt,
  pageAt,
  nextPageAt,
  nextLiveAt,
  onRefresh,
}: {
  /** The latest closing prices the broker used (its trading decisions use these). */
  closesAsOf: string | null;
  /** The newest live trade among the shown prices, and when they were fetched. */
  liveTradeAt: string | null;
  liveCheckedAt: Date | null;
  /** When the page last loaded its data. */
  pageAt: Date | null;
  nextPageAt: Date | null;
  nextLiveAt: Date | null;
  onRefresh: () => void;
}) {
  // Ticks every second for the countdowns.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const parts = [
    closesAsOf && `Closing prices from ${tradingDay(closesAsOf)} (what the broker decides on)`,
    liveTradeAt &&
      liveCheckedAt &&
      `live prices from ${when(liveTradeAt)}, checked ${when(liveCheckedAt)}`,
    pageAt && `page updated ${when(pageAt)}`,
  ].filter(Boolean);
  const next = [
    nextPageAt && `page in ${left(nextPageAt, now)}`,
    nextLiveAt && `live prices in ${left(nextLiveAt, now)}`,
  ].filter(Boolean);
  return (
    <Group gap="xs" justify="space-between" wrap="wrap">
      <Text size="xs" c="dimmed">
        {parts.join(' · ')}
        {next.length > 0 && ` · next update: ${next.join(', ')}`}
      </Text>
      <Button
        size="compact-xs"
        variant="subtle"
        leftSection={<IconRefresh size={12} />}
        onClick={onRefresh}
      >
        Refresh now
      </Button>
    </Group>
  );
}
