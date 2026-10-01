import {
  Alert,
  Anchor,
  Button,
  Collapse,
  Group,
  List,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useState } from 'react';
import { IconBulb, IconInfoCircle, IconPlayerPlay, IconSparkles } from '@tabler/icons-react';
import type { PlanContext, TestPlan } from '../../api/research-types';
import type { AiSummary } from '../../api/types';
import { planParams } from '../../lib/plan';

interface Props {
  summary: AiSummary | null;
  skipped: string | null;
  saved?: boolean;
  title?: string;
  /** Runs one of the suggested next tests. */
  onRunPlan?: (plan: TestPlan, ctx: PlanContext) => void;
}

function NextTests({ summary, onRunPlan }: Pick<Props, 'onRunPlan'> & { summary: AiSummary }) {
  const ctx = summary.testContext;
  if (!ctx || !summary.nextTests?.length) return null;
  return (
    <Stack gap="xs" mt="md">
      <Text size="sm" fw={600}>
        Suggested next tests
      </Text>
      {summary.nextTests.map((plan) => (
        <Group key={JSON.stringify(plan)} justify="space-between" wrap="nowrap" gap="sm">
          <div>
            <Text size="sm">{plan.why || `${plan.kind} of ${plan.strategies.join(', ')}`}</Text>
            <Text size="xs" c="dimmed">
              {plan.kind === 'walkforward' ? `walk-forward ${plan.train}/${plan.test}` : 'sweep'} ·{' '}
              {plan.strategies.join(' + ')} · {planParams(plan)}
            </Text>
          </div>
          {onRunPlan && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlayerPlay size={14} />}
              onClick={() => onRunPlan(plan, ctx)}
            >
              Run
            </Button>
          )}
        </Group>
      ))}
    </Stack>
  );
}

export function AiSummaryCard({ summary, skipped, saved, title = 'AI summary', onRunPlan }: Props) {
  const [open, setOpen] = useState(false);
  if (!summary) {
    return skipped ? (
      <Alert variant="light" color="gray" icon={<IconInfoCircle />} title="No AI summary">
        {skipped}
      </Alert>
    ) : null;
  }
  return (
    <Paper p="lg">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <ThemeIcon variant="light" color="violet" radius="xl">
            <IconSparkles size={16} />
          </ThemeIcon>
          <Text fw={600}>{title}</Text>
        </Group>
        <Text size="xs" c="dimmed">
          {summary.model}
          {saved ? ' · saved' : ''} · can be wrong, check the numbers
        </Text>
      </Group>
      <Text fw={600} fz="md" mb="sm">
        {summary.headline}
      </Text>
      <Collapse expanded={open}>
        {summary.points.length > 0 && (
          <List size="sm" spacing={6} mb="md">
            {summary.points.map((p) => (
              <List.Item key={p}>{p}</List.Item>
            ))}
          </List>
        )}
        <Alert variant="light" color="indigo" icon={<IconBulb />} title="Recommendation">
          {summary.recommendation}
        </Alert>
      </Collapse>
      <Anchor component="button" type="button" size="sm" onClick={() => setOpen((o) => !o)}>
        {open ? 'Show less' : 'Read the details'}
      </Anchor>
      <NextTests summary={summary} onRunPlan={onRunPlan} />
    </Paper>
  );
}
