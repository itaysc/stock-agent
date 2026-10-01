import { Badge, Button, Group, Paper, Table, Text } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import type { ReportItem } from '../api/types';
import { timeAgo } from '../lib/format';

const KIND_COLORS: Record<ReportItem['kind'], string> = {
  backtest: 'indigo',
  sweep: 'grape',
  walkforward: 'teal',
  research: 'orange',
  portfolio: 'cyan',
};
const KIND_LABELS: Record<ReportItem['kind'], string> = {
  backtest: 'backtest',
  sweep: 'sweep',
  walkforward: 'walk-forward',
  research: 'AI research',
  portfolio: 'portfolio',
};

interface Props {
  reports: ReportItem[];
  activeUrl: string | null;
  onOpen: (report: ReportItem) => void;
}

export function RecentReports({ reports, activeUrl, onOpen }: Props) {
  return (
    <Paper p="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Recent reports</Text>
        <Text size="xs" c="dimmed">
          {reports.length ? `${reports.length} newest` : ''}
        </Text>
      </Group>
      {reports.length === 0 ? (
        <Text size="sm" c="dimmed">
          No reports yet. Your runs will show up here.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing={6} fz="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Strategy</Table.Th>
                <Table.Th>Symbols</Table.Th>
                <Table.Th>Period</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reports.map((r) => (
                <Table.Tr
                  key={r.name}
                  bg={r.url === activeUrl ? 'var(--mantine-primary-color-light)' : undefined}
                >
                  <Table.Td>
                    <Badge variant="light" color={KIND_COLORS[r.kind]} size="sm">
                      {KIND_LABELS[r.kind]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{r.strategy}</Table.Td>
                  <Table.Td>{r.symbols.join(', ') || '–'}</Table.Td>
                  <Table.Td>{r.period ?? '–'}</Table.Td>
                  <Table.Td c="dimmed">{timeAgo(r.createdAt)}</Table.Td>
                  <Table.Td ta="right">
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      leftSection={<IconEye size={14} />}
                      onClick={() => onOpen(r)}
                    >
                      View
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
