import { ActionIcon, Group, Paper, SimpleGrid, Text, Title, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { DailyResult } from '../../api/broker-types';
import { money, pct } from '../../lib/format';
import { nyDay } from '../../lib/live';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthKey = (date: string) => date.slice(0, 7);
const shift = (key: string, by: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};
/** "+1.2%": one decimal, so it fits a phone-width cell (the tooltip has the exact figures). */
const short = (p: number) => `${p > 0 ? '+' : p < 0 ? '-' : ''}${Math.abs(p).toFixed(1)}%`;
/** Green or red, deeper for bigger days (full at ±3%). */
const shade = (p: number) => {
  const a = Math.min(1, Math.abs(p) / 3) * 0.55 + 0.12;
  return p >= 0 ? `rgba(18, 184, 134, ${a})` : `rgba(250, 82, 82, ${a})`;
};

/** A month of trading days, each green or red by that day's result; ‹ › to move between months. */
export function MonthCalendar({
  days,
  title = 'Day by day',
}: {
  days: DailyResult[];
  title?: string;
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const first = days[0] ? monthKey(days[0].date) : null;
  const last = days.at(-1) ? monthKey(days.at(-1)!.date) : null;
  const [month, setMonth] = useState<string>(last ?? new Date().toISOString().slice(0, 7));
  if (!first || !last) return null;

  const [y, m] = month.split('-').map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const inMonth = days.filter((d) => monthKey(d.date) === month);
  const total = inMonth.reduce((n, d) => n + d.pnl, 0);
  // Each day's % compounded: right also when an investment starts mid-month (more money, same %).
  const monthPct = (inMonth.reduce((n, d) => n * (1 + d.pct / 100), 1) - 1) * 100;
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const today = nyDay(new Date().toISOString());

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Title order={5}>{title}</Title>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            aria-label="Previous month"
            disabled={month <= first}
            onClick={() => setMonth((k) => shift(k, -1))}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text size="sm" fw={600} w={130} ta="center">
            {label}
          </Text>
          <ActionIcon
            variant="subtle"
            aria-label="Next month"
            disabled={month >= last}
            onClick={() => setMonth((k) => shift(k, 1))}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
      <Text size="xs" c={inMonth.length ? (total >= 0 ? 'teal' : 'red') : 'dimmed'} mb="xs">
        {inMonth.length
          ? `This month: ${total >= 0 ? '+' : '-'}${money(Math.abs(total))} (${pct(monthPct)}) over ${inMonth.length} trading days`
          : 'No trading days this month'}
      </Text>
      <SimpleGrid cols={7} spacing={4} verticalSpacing={4}>
        {WEEKDAYS.map((w) => (
          <Text key={w} size="xs" c="dimmed" ta="center">
            {w}
          </Text>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const d = byDate.get(date);
          const cell = (
            <Paper
              px={3}
              py={4}
              radius="sm"
              h={48}
              style={{
                background: d ? shade(d.pct) : undefined,
                outline: date === today ? '1px solid var(--mantine-color-blue-5)' : undefined,
                // Today so far (live prices): dashed until the close is in.
                borderStyle: d?.live ? 'dashed' : undefined,
              }}
              withBorder={!d || d.live}
            >
              <Text size="xs" c={d ? undefined : 'dimmed'}>
                {i + 1}
              </Text>
              {d && (
                <Text
                  fz={10}
                  fw={600}
                  ta="right"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {short(d.pct)}
                </Text>
              )}
            </Paper>
          );
          return d ? (
            <Tooltip
              key={date}
              label={`${date}${d.live ? ' so far (live prices; final after the close)' : ''}: ${d.pnl >= 0 ? '+' : '-'}${money(Math.abs(d.pnl))} (${pct(d.pct)}) · worth ${money(d.equity)}`}
              withArrow
            >
              {cell}
            </Tooltip>
          ) : (
            <div key={date}>{cell}</div>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}
