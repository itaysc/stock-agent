import { Button, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { IconBrain } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AutopilotRun } from '../../api/paper-types';
import type { ResearchSession } from '../../api/research-types';
import { planParams } from '../../lib/plan';

const signed = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const minutes = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

/** What the autopilot is doing right now, and the agent's latest thinking. */
export function AgentNow({
  run,
  onReasoning,
}: {
  run: AutopilotRun;
  onReasoning: (researchId: string) => void;
}) {
  const a = run.activity;
  const researchId = a?.researchId ?? null;
  const [session, setSession] = useState<ResearchSession | null>(null);
  useEffect(() => {
    if (!researchId) return setSession(null);
    let gone = false;
    const load = () =>
      api.research(researchId).then(
        (s) => !gone && setSession(s),
        () => undefined,
      );
    void load();
    const timer = setInterval(() => void load(), 5_000);
    return () => {
      gone = true;
      clearInterval(timer);
    };
  }, [researchId]);
  const round = session?.rounds.at(-1);
  const last = session?.experiments.at(-1);
  return (
    <Paper p="sm" withBorder bg="var(--mantine-color-blue-light)">
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Loader size="xs" />
            <Text size="sm" fw={600}>
              Now: {a?.step ?? 'starting'}
            </Text>
            {a && (
              <Text size="xs" c="dimmed">
                for {minutes(a.since)} min · run started {minutes(run.startedAt)} min ago
              </Text>
            )}
          </Group>
          {researchId && (
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconBrain size={14} />}
              onClick={() => onReasoning(researchId)}
            >
              Watch it think
            </Button>
          )}
        </Group>
        {round && (
          <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
            <b>Its thinking (round {round.round}):</b> {round.thinking}
          </Text>
        )}
        {last && (
          <Text size="xs" c="dimmed">
            Last test #{last.id}: {last.plan.strategies.join(' + ')} {planParams(last.plan)} →{' '}
            {last.error
              ? `failed: ${last.error}`
              : last.outcome
                ? `${signed(last.outcome.returnPct)} vs ${signed(last.outcome.holdReturnPct)} holding`
                : 'running'}
          </Text>
        )}
        {run.decisions
          .filter((d) => d.kind !== 'kept')
          .slice(-3)
          .map((d, i) => (
            <Text key={i} size="xs" c="dimmed">
              ✓ {d.message}
            </Text>
          ))}
      </Stack>
    </Paper>
  );
}
