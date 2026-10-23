import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';

/**
 * A two-line row for phones, in place of a wide table row: what and how much
 * on top, the details under it (dimmed). Rows sit in a list with dividers.
 */
export function ListRow({
  title,
  value,
  sub,
  subValue,
  valueColor,
  onClick,
}: {
  title: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  subValue?: ReactNode;
  valueColor?: string;
  /** Tapping the row opens it (a chevron shows it can). */
  onClick?: () => void;
}) {
  const row = (
    <Stack
      gap={2}
      py={10}
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm" fw={600} style={{ minWidth: 0 }} truncate>
          {title}
        </Text>
        <Text size="sm" fw={600} c={valueColor} style={{ flexShrink: 0 }}>
          {value}
        </Text>
      </Group>
      {(sub || subValue) && (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
            {sub}
          </Text>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {subValue}
          </Text>
        </Group>
      )}
    </Stack>
  );
  if (!onClick) return row;
  return (
    <UnstyledButton onClick={onClick} w="100%">
      <Group wrap="nowrap" gap="xs">
        <div style={{ flex: 1, minWidth: 0 }}>{row}</div>
        <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
      </Group>
    </UnstyledButton>
  );
}
