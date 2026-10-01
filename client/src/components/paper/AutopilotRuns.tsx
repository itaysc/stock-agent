import { Accordion, Anchor, Badge, Group, List, Text } from '@mantine/core';
import type { AutopilotRun } from '../../api/paper-types';

const KIND_COLOR: Record<AutopilotRun['decisions'][number]['kind'], string> = {
  deployed: 'teal',
  proposed: 'violet',
  retired: 'orange',
  researched: 'blue',
  kept: 'gray',
  skipped: 'gray',
  error: 'red',
};
const TRIGGER: Record<AutopilotRun['trigger'], string> = {
  schedule: 'scheduled',
  manual: 'run now',
  review: 'hourly check',
  chat: 'Telegram /check',
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'n/a');

/** Recent runs and every decision, each with a link to the agent's reasoning. */
export function AutopilotRuns({
  runs,
  onReasoning,
}: {
  runs: AutopilotRun[];
  onReasoning: (researchId: string) => void;
}) {
  return runs
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .slice(0, 8)
    .map((r) => (
      <Accordion.Item key={r.id} value={r.id}>
        <Accordion.Control>
          <Group gap="xs">
            <Badge
              size="xs"
              variant="light"
              color={r.status === 'failed' ? 'red' : r.status === 'running' ? 'blue' : 'gray'}
            >
              {r.status}
            </Badge>
            <Text size="sm">
              {when(r.startedAt)} · {TRIGGER[r.trigger]} ·{' '}
              {r.decisions.filter((d) => d.kind === 'proposed').length} ideas,{' '}
              {r.decisions.filter((d) => d.kind === 'deployed').length} deployed,{' '}
              {r.decisions.filter((d) => d.kind === 'retired').length} retired
            </Text>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          {r.error && (
            <Text size="sm" c="red">
              {r.error}
            </Text>
          )}
          <List size="sm" spacing={4}>
            {r.decisions.map((d, i) => (
              <List.Item
                key={i}
                icon={
                  <Badge size="xs" variant="light" color={KIND_COLOR[d.kind]}>
                    {d.kind}
                  </Badge>
                }
              >
                {d.message}
                {d.researchId && d.kind === 'researched' && (
                  <>
                    {' '}
                    <Anchor
                      component="button"
                      size="xs"
                      onClick={() => d.researchId && onReasoning(d.researchId)}
                    >
                      reasoning
                    </Anchor>
                  </>
                )}
              </List.Item>
            ))}
          </List>
        </Accordion.Panel>
      </Accordion.Item>
    ));
}
