import { Badge, Box, Text, Tooltip } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

type Clock = { isOpen: boolean; nextOpen: string; nextClose: string };

/** "2h 14m", "15m 03s", "1d 3h": the time left until `ms` from now. */
export function timeLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${sec}s`;
}

/**
 * The US market: open (closes in …) or closed (opens in …), counting down
 * every second. `compact`: one small line with a status dot (the phone's top bar).
 */
export function MarketClock({ compact = false }: { compact?: boolean }) {
  const [clock, setClock] = useState<Clock | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const load = () => void api.marketClock().then(setClock, () => undefined);
    load();
    const refresh = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, []);
  // When the countdown runs out (it just opened or closed), ask for the new times.
  const target = clock ? Date.parse(clock.isOpen ? clock.nextClose : clock.nextOpen) : 0;
  useEffect(() => {
    if (clock && now >= target) void api.marketClock().then(setClock, () => undefined);
  }, [clock, now, target]);
  if (!clock) return null;
  const at = new Date(target).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (compact)
    return (
      <Text size="xs" c="dimmed" lh={1.2} style={{ fontVariantNumeric: 'tabular-nums' }}>
        <Box
          component="span"
          display="inline-block"
          w={7}
          h={7}
          mr={5}
          bg={clock.isOpen ? 'teal' : 'gray'}
          style={{ borderRadius: '50%' }}
        />
        {clock.isOpen ? 'Market open · closes in ' : 'Market closed · opens in '}
        {timeLeft(target - now)}
      </Text>
    );
  return (
    <Tooltip
      label={`US stock market ${clock.isOpen ? 'closes' : 'opens'} ${at} your time (holidays and early closes included)`}
      withArrow
    >
      <Badge
        variant="light"
        color={clock.isOpen ? 'teal' : 'gray'}
        visibleFrom="sm"
        tt="none"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {clock.isOpen ? 'Market open · closes in ' : 'Market closed · opens in '}
        {timeLeft(target - now)}
      </Badge>
    </Tooltip>
  );
}
