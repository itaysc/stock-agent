import {
  Badge,
  Group,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { BacktestOptions } from '../../api/types';
import type { FormValues } from '../../lib/form';
import { comboCount, countValues } from '../../lib/paramGrid';
import { backtestErrors, sweepErrors } from '../../lib/paramRules';
import { ParamInputs, placeholder } from './ParamInputs';
import { ParamLabel } from './ParamLabel';

interface Props {
  form: UseFormReturnType<FormValues>;
  options: BacktestOptions;
}

export function StrategyFields({ form, options }: Props) {
  const v = form.values;
  const byName = new Map(options.strategies.map((s) => [s.name, s]));
  const data = options.strategies.map((s) => ({
    value: s.name,
    label: s.name,
  }));
  const describe = (name: string) => byName.get(name)?.description;
  // Replace the strategy's whole map: Mantine's setFieldValue('a.b.c') silently
  // does nothing when `a.b` doesn't exist yet (it never creates parents).
  const setParam = (field: 'params' | 'specs', strategy: string, param: string, value: string) =>
    form.setFieldValue(field, {
      ...v[field],
      [strategy]: { ...v[field][strategy], [param]: value },
    });

  if (v.mode === 'research') {
    return (
      <MultiSelect
        label="Strategies the agent may use"
        description="It picks the settings, and combines building blocks with the rules strategy"
        data={data}
        {...form.getInputProps('strategies')}
      />
    );
  }

  if (v.mode === 'backtest') {
    const strategy = byName.get(v.strategy);
    const errors = backtestErrors(strategy, v.params[v.strategy], v.symbols.length);
    return (
      <Stack gap="xs">
        <Select
          label="Strategy"
          description={describe(v.strategy)}
          data={data}
          allowDeselect={false}
          {...form.getInputProps('strategy')}
        />
        <ParamInputs
          strategy={strategy}
          values={v.params[v.strategy]}
          errors={errors}
          onChange={(param, value) => setParam('params', v.strategy, param, value)}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <MultiSelect
        label="Strategies"
        description={
          v.mode === 'walkforward'
            ? 'Each training window picks the best setting from all of these'
            : 'Pick several to compare them side by side'
        }
        data={data}
        {...form.getInputProps('strategies')}
      />
      {v.strategies.map((name) => {
        const specs = v.specs[name] ?? {};
        const count = comboCount(specs);
        const errors = sweepErrors(byName.get(name), specs);
        return (
          <Paper key={name} p="sm" bg="var(--mantine-color-default-hover)" withBorder={false}>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={600}>
                {name}
              </Text>
              <Badge variant="light" color={count > options.maxCombinations ? 'red' : 'indigo'}>
                {count} {v.mode === 'walkforward' ? 'setting' : 'run'}
                {count === 1 ? '' : 's'}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              Values to try: <code>10</code>, <code>5,10,20</code> or <code>5..30:5</code>
            </Text>
            <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
              {byName.get(name)?.params.map((p) => {
                const spec = specs[p.name] ?? '';
                const { count: n } = countValues(spec);
                const error = errors[p.name];
                return (
                  <TextInput
                    key={p.name}
                    label={<ParamLabel name={p.name} description={p.description} />}
                    placeholder={placeholder(p)}
                    size="xs"
                    error={error}
                    rightSection={
                      spec && !error ? (
                        <Text size="xs" c="dimmed">
                          {n}
                        </Text>
                      ) : null
                    }
                    value={spec}
                    onChange={(e) => setParam('specs', name, p.name, e.currentTarget.value)}
                  />
                );
              })}
            </SimpleGrid>
            {count > options.maxCombinations && (
              <Text size="xs" c="red" mt="xs">
                Max {options.maxCombinations} runs per strategy: use fewer values or bigger steps.
              </Text>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
