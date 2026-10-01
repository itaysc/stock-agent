import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconInfoCircle } from '@tabler/icons-react';
import type { BacktestOptions } from '../../api/types';
import { type FormValues, lastYears, type Mode } from '../../lib/form';

const EXPLAIN: Record<Mode, string> = {
  backtest:
    'Backtest: replays one strategy with fixed settings over past prices to show how it would have performed.',
  sweep:
    'Sweep: runs many backtests at once, one per combination of settings, and ranks them to show which settings hold up.',
  walkforward:
    'Walk-forward: picks the best settings on a training period, then trades them on the next, unseen period, again and again. Only the unseen periods count, so it shows whether a sweep’s winner really works.',
  portfolio:
    'Portfolio: several strategies at once, each with its own symbols and share of the money, on one account. Shows the whole result, what each part added, and a safety stop for the whole portfolio.',
  research:
    'AI agent: in rounds, an AI proposes walk-forward tests (strategies, rule combinations, settings), learns from the results and tries better ideas. The last part of the period is hidden from it; the best idea is checked there once at the end.',
};

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'backtest', label: 'Backtest' },
  { value: 'sweep', label: 'Sweep' },
  { value: 'walkforward', label: 'Walk-fwd' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'research', label: 'AI agent' },
];

interface Props {
  form: UseFormReturnType<FormValues>;
  options: BacktestOptions;
}

export function ModeSwitch({ form, options }: Props) {
  const mode = form.values.mode;
  const change = (next: Mode) => {
    form.setFieldValue('mode', next);
    // Walk-forward and the agent need a longer history, and the agent may use
    // every strategy; only replace values the user hasn't picked.
    const reset: Partial<FormValues> = {};
    if (next !== 'backtest' && next !== 'sweep' && !form.isDirty('period')) {
      reset.period = lastYears(options.defaults.walkForward.years, options.dataStart);
    }
    if (next === 'research' && !form.isDirty('strategies')) {
      reset.strategies = options.strategies.map((s) => s.name);
    }
    if (Object.keys(reset).length) {
      form.setValues(reset);
      form.resetDirty({ ...form.values, mode: next, ...reset });
    }
  };
  return (
    <Stack gap={6}>
      <SimpleGrid cols={3} spacing={6} verticalSpacing={6}>
        {MODES.map((m) => (
          <Button
            key={m.value}
            size="xs"
            variant={mode === m.value ? 'filled' : 'default'}
            onClick={() => change(m.value)}
            aria-pressed={mode === m.value}
          >
            {m.label}
          </Button>
        ))}
      </SimpleGrid>
      <Group gap={6} wrap="nowrap" align="flex-start">
        <IconInfoCircle
          size={16}
          style={{ flexShrink: 0, marginTop: 2 }}
          color="var(--mantine-color-dimmed)"
        />
        <Text size="xs" c="dimmed">
          {EXPLAIN[mode]}
        </Text>
      </Group>
    </Stack>
  );
}
