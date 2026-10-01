import { Badge, Group, Paper, Progress, Stack, Text, UnstyledButton } from '@mantine/core';
import type { DeploymentView } from '../../api/paper-types';
import { money, tone } from '../../lib/format';
import { HEALTH, STATUS_COLOR } from './status';

interface Props {
  d: DeploymentView;
  selected: boolean;
  onSelect: () => void;
}

/** One deployment in the list: money now vs put in, and how close it is to its guard. */
export function DeploymentCard({ d, selected, onSelect }: Props) {
  const toGuard =
    d.maxDrawdownPct > 0 ? Math.min(100, (d.drawdownPct / d.maxDrawdownPct) * 100) : 0;
  return (
    <UnstyledButton onClick={onSelect} w="100%">
      <Paper
        p="sm"
        withBorder
        style={{ borderColor: selected ? 'var(--mantine-primary-color-filled)' : undefined }}
      >
        <Stack gap={6}>
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600} size="sm" lineClamp={1}>
              {d.name}
            </Text>
            <Group gap={4} wrap="nowrap">
              {d.source.kind === 'autopilot' && (
                <Badge size="sm" variant="light" color="violet">
                  autopilot
                </Badge>
              )}
              <Badge size="sm" variant="light" color={STATUS_COLOR[d.status]}>
                {d.status}
              </Badge>
            </Group>
          </Group>
          <Group justify="space-between" align="flex-end">
            <div>
              <Text fz="lg" fw={700}>
                {money(d.equity)}
              </Text>
              <Text size="xs" c="dimmed">
                from {money(d.capital)} · {d.daysLive} day{d.daysLive === 1 ? '' : 's'}
              </Text>
            </div>
            <Text fw={700} c={tone(d.pnl)}>
              {d.pnl >= 0 ? '+' : '−'}
              {money(Math.abs(d.pnl))} ({d.pnlPct >= 0 ? '+' : ''}
              {d.pnlPct.toFixed(1)}%)
            </Text>
          </Group>
          {d.status !== 'stopped' && d.maxDrawdownPct > 0 && (
            <div>
              <Progress
                value={toGuard}
                size="xs"
                color={toGuard > 75 ? 'red' : toGuard > 40 ? 'orange' : 'teal'}
              />
              <Text size="xs" c="dimmed" mt={2}>
                {d.drawdownPct.toFixed(1)}% below its peak · guard at {d.maxDrawdownPct}%
              </Text>
            </div>
          )}
          <Text size="xs" c={HEALTH[d.health].color}>
            {HEALTH[d.health].label}
          </Text>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}
