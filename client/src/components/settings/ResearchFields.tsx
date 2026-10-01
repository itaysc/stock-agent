import { NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { ResearchGoal } from '../../api/research-types';
import type { BacktestOptions } from '../../api/types';
import type { FormValues } from '../../lib/form';
import { durationLabel, parseDuration } from '../../lib/walkForward';
import { ParamLabel } from './ParamLabel';

const GOALS: Record<ResearchGoal, { label: string; description: string }> = {
  'risk-adjusted': {
    label: 'Best risk / reward',
    description: 'Return per unit of drawdown, better than buy & hold’s',
  },
  'beat-hold': { label: 'Beat buy & hold', description: 'Annual return above buy & hold’s' },
  return: { label: 'Highest return', description: 'Annual return, ignoring risk' },
};

interface Props {
  form: UseFormReturnType<FormValues>;
  options: BacktestOptions;
}

export function ResearchFields({ form, options }: Props) {
  const v = form.values;
  const holdout = parseDuration(v.holdout);
  return (
    <Stack gap="sm">
      <Select
        label="Goal"
        description={GOALS[v.goal].description}
        data={options.defaults.research.goals.map((g) => ({ value: g, label: GOALS[g].label }))}
        allowDeselect={false}
        {...form.getInputProps('goal')}
      />
      <TextInput
        label={
          <ParamLabel
            name="Holdout"
            description="The last part of the period is hidden from the agent. Its best idea is tested there once at the end: the honest result, since the more ideas it tries, the more likely one wins by luck."
          />
        }
        description={holdout ? `last ${durationLabel(holdout)} hidden` : undefined}
        placeholder="12m"
        error={holdout ? undefined : 'Like 6m, 12m or 1y'}
        {...form.getInputProps('holdout')}
      />
      <Select
        label={
          <ParamLabel
            name="Check on other symbols"
            description="At the end, the best idea is also run on each symbol of this basket, on its own. It only counts as a paper-trading candidate if it beats holding on most of them: something that works on one stock only is most likely luck."
          />
        }
        data={[
          ...options.baskets.map((b) => ({
            value: b.id,
            label: `${b.name} (${b.symbols.length})`,
          })),
          { value: 'none', label: 'Skip this check' },
        ]}
        allowDeselect={false}
        {...form.getInputProps('basket')}
      />
      <SimpleGrid cols={2} spacing="xs">
        <NumberInput
          label="Rounds"
          description="Max, 1-10"
          min={1}
          max={10}
          clampBehavior="strict"
          {...form.getInputProps('rounds')}
        />
        <NumberInput
          label="Tests per round"
          description="1-5"
          min={1}
          max={5}
          clampBehavior="strict"
          {...form.getInputProps('testsPerRound')}
        />
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        Up to {v.rounds * v.testsPerRound} walk-forward tests and {v.rounds + 1} AI calls (a few
        cents). Usually takes a few minutes; you can follow it live.
      </Text>
    </Stack>
  );
}
