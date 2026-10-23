import { Badge, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { money, pct } from '../../lib/format';
import { Sparkline } from './Sparkline';

/** A label and its value in a card's details. */
export interface CardStat {
  label: string;
  value: ReactNode;
  color?: string;
}

/**
 * One stock as a card, for phones (where a wide table would scroll
 * sideways): symbol and price on the top line, a short subtitle and the
 * change under them, the details as aligned label/value pairs, the trend
 * across the full width (tap it for the large chart), then actions.
 */
export function StockCard({
  symbol,
  badge,
  subtitle,
  price,
  changePct,
  changeNote,
  stats,
  note,
  spark,
  entryPrice,
  boughtAt,
  menu,
  actions,
  onOpen,
}: {
  symbol: string;
  /** Next to the symbol, e.g. a status. */
  badge?: ReactNode;
  /** Under the symbol, e.g. "26.29 shares". */
  subtitle?: ReactNode;
  price: number | null;
  changePct?: number | null;
  /** Next to the change, e.g. "+$354" or "12 mo". */
  changeNote?: string;
  stats?: CardStat[];
  /** A line of text under the details. */
  note?: ReactNode;
  spark?: Array<{ t: string; c: number }>;
  entryPrice?: number | null;
  boughtAt?: string | null;
  /** An icon button in the top right corner (actions menu). */
  menu?: ReactNode;
  /** Buttons along the bottom. */
  actions?: ReactNode;
  /** Opens the large chart. */
  onOpen?: () => void;
}) {
  const up = (changePct ?? 0) >= 0;
  return (
    <Paper p="sm" withBorder style={{ fontVariantNumeric: 'tabular-nums' }}>
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text fw={700} size="lg" lh={1.25}>
                {symbol}
              </Text>
              {badge}
            </Group>
            {subtitle && (
              <Text size="xs" c="dimmed" lh={1.3}>
                {subtitle}
              </Text>
            )}
          </Stack>
          <Group gap={2} align="flex-start" wrap="nowrap">
            <Stack gap={4} align="flex-end">
              <Text fw={700} size="lg" lh={1.25}>
                {price === null ? '—' : money(price)}
              </Text>
              {changePct != null && (
                <Badge
                  variant="light"
                  color={up ? 'teal' : 'red'}
                  size="md"
                  radius="sm"
                  tt="none"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {pct(changePct)}
                  {changeNote ? ` · ${changeNote}` : ''}
                </Badge>
              )}
            </Stack>
            {menu}
          </Group>
        </Group>
        {stats && stats.length > 0 && (
          <SimpleGrid cols={2} spacing="xs" verticalSpacing={6}>
            {stats.map((s) => (
              <div key={s.label} style={{ minWidth: 0 }}>
                <Text size="xs" c="dimmed" lh={1.2}>
                  {s.label}
                </Text>
                <Text size="sm" fw={500} c={s.color} lh={1.3}>
                  {s.value}
                </Text>
              </div>
            ))}
          </SimpleGrid>
        )}
        {note && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {note}
          </Text>
        )}
        {spark && spark.length > 1 && (
          <UnstyledButton
            onClick={onOpen}
            aria-label={`Open the ${symbol} chart`}
            disabled={!onOpen}
          >
            <Sparkline points={spark} entryPrice={entryPrice} boughtAt={boughtAt} fluid />
          </UnstyledButton>
        )}
        {actions && (
          <Group gap="xs" grow wrap="nowrap">
            {actions}
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
