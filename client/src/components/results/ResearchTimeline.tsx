import { Badge, Group, List, Loader, Paper, Stack, Table, Text, Timeline } from '@mantine/core';
import { IconBrain } from '@tabler/icons-react';
import type { Experiment, ResearchSession } from '../../api/research-types';
import { pct, tone } from '../../lib/format';
import { planParams } from '../../lib/plan';

function ExperimentRow({ e, champion }: { e: Experiment; champion: boolean }) {
  const o = e.outcome;
  const how = e.plan.train
    ? `${e.plan.train}/${e.plan.test}${e.plan.anchored ? ' anchored' : ''}`
    : '';
  return (
    <Table.Tr bg={champion ? 'var(--mantine-primary-color-light)' : undefined}>
      <Table.Td>#{e.id}</Table.Td>
      <Table.Td>
        <Text size="sm" fw={champion ? 700 : 500}>
          {e.plan.strategies.join(' + ')}{' '}
          <Text span c="dimmed" size="xs">
            {how}
          </Text>
        </Text>
        <Text size="xs" c="dimmed">
          {planParams(e.plan)}
        </Text>
        {e.plan.why && (
          <Text size="xs" fs="italic" c="dimmed">
            {e.plan.why}
          </Text>
        )}
      </Table.Td>
      {o ? (
        <>
          <Table.Td ta="right" c={tone(o.returnPct)}>
            {pct(o.returnPct)}
            <Text size="xs" c="dimmed">
              hold {pct(o.holdReturnPct)}
            </Text>
          </Table.Td>
          <Table.Td ta="right">-{o.maxDrawdownPct.toFixed(1)}%</Table.Td>
          <Table.Td ta="right">
            {o.trades}
            {e.weak && (
              <Badge size="xs" ml={4} color="gray" variant="light">
                weak
              </Badge>
            )}
          </Table.Td>
          <Table.Td ta="right" fw={600} c={tone(e.score)}>
            {e.score?.toFixed(2)}
          </Table.Td>
        </>
      ) : (
        <Table.Td colSpan={4} c="red">
          <Text size="xs">{e.error ?? 'not run'}</Text>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

/** Every round: the agent's reasoning, its ideas, and the tests it ran. */
export function ResearchTimeline({ session }: { session: ResearchSession }) {
  const running = session.status === 'running';
  return (
    <Paper p="lg">
      <Timeline bulletSize={26} lineWidth={2} active={session.rounds.length}>
        {session.rounds.map((round) => {
          const tests = session.experiments.filter((e) => e.round === round.round);
          return (
            <Timeline.Item
              key={round.round}
              bullet={<IconBrain size={14} />}
              title={`Round ${round.round}`}
            >
              <Stack gap={6} mt={4}>
                <Text size="sm">{round.thinking || '(no reasoning given)'}</Text>
                {(round.ideas.length > 0 || round.rejected.length > 0) && (
                  <List size="xs" c="dimmed" spacing={2}>
                    {round.ideas.map((i) => (
                      <List.Item key={i}>Idea for a new building block: {i}</List.Item>
                    ))}
                    {round.rejected.map((r) => (
                      <List.Item key={r}>Rejected by the menu: {r}</List.Item>
                    ))}
                  </List>
                )}
                {tests.length > 0 && (
                  <Table.ScrollContainer minWidth={560}>
                    <Table verticalSpacing={4} fz="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Test</Table.Th>
                          <Table.Th ta="right">Unseen</Table.Th>
                          <Table.Th ta="right">Max DD</Table.Th>
                          <Table.Th ta="right">Trades</Table.Th>
                          <Table.Th ta="right">Score</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {tests.map((e) => (
                          <ExperimentRow key={e.id} e={e} champion={e.id === session.championId} />
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Stack>
            </Timeline.Item>
          );
        })}
        {running && (
          <Timeline.Item
            bullet={<Loader size={12} />}
            title={session.holdout ? 'Writing the verdict…' : 'Working…'}
          >
            <Group gap={6} mt={4}>
              <Text size="sm" c="dimmed">
                {session.rounds.length === 0
                  ? 'Fetching prices and planning the first tests…'
                  : 'Running tests, or planning the next round from the results…'}
              </Text>
            </Group>
          </Timeline.Item>
        )}
      </Timeline>
    </Paper>
  );
}
