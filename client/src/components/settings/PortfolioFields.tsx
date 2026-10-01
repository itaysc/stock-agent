import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { BacktestOptions, SleeveInput } from '../../api/types';
import type { FormValues } from '../../lib/form';
import { backtestErrors } from '../../lib/paramRules';
import { ParamInputs } from './ParamInputs';
import { ParamLabel } from './ParamLabel';

interface Props {
  form: UseFormReturnType<FormValues>;
  options: BacktestOptions;
}

const MAX_SLEEVES = 10;

/** The portfolio's sleeves (strategy, symbols, settings, share of the money) and its stop. */
export function PortfolioFields({ form, options }: Props) {
  const { sleeves } = form.values;
  const total = sleeves.reduce((n, s) => n + (s.weightPct || 0), 0);
  const byName = new Map(options.strategies.map((s) => [s.name, s]));
  // Replace the whole list: nested setFieldValue paths don't create missing parents.
  const update = (i: number, change: Partial<SleeveInput>) =>
    form.setFieldValue(
      'sleeves',
      sleeves.map((s, j) => (j === i ? { ...s, ...change } : s)),
    );
  const remove = (i: number) =>
    form.setFieldValue(
      'sleeves',
      sleeves.filter((_, j) => j !== i),
    );
  const add = () =>
    form.setFieldValue('sleeves', [
      ...sleeves,
      {
        strategy: options.strategies[0]?.name ?? 'sma-crossover',
        symbols: [],
        params: {},
        weightPct: Math.max(0, Math.min(20, 100 - total)),
      },
    ]);

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        Sleeves
      </Text>
      {sleeves.map((s, i) => (
        <Paper key={i} p="sm" bg="var(--mantine-color-default-hover)" withBorder={false}>
          <Group justify="space-between" mb={6}>
            <Text size="sm" fw={600}>
              Sleeve {i + 1}
            </Text>
            <Group gap={6}>
              <NumberInput
                size="xs"
                w={96}
                suffix="%"
                min={0.1}
                max={100}
                decimalScale={1}
                value={s.weightPct}
                onChange={(v) => update(i, { weightPct: Number(v) || 0 })}
                aria-label={`Sleeve ${i + 1} share of the money`}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => remove(i)}
                disabled={sleeves.length === 1}
                aria-label={`Remove sleeve ${i + 1}`}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
          <SimpleGrid cols={2} spacing="xs" mb="xs">
            <Select
              size="xs"
              label="Strategy"
              data={options.strategies.map((x) => x.name)}
              allowDeselect={false}
              value={s.strategy}
              onChange={(v) => v && update(i, { strategy: v, params: {} })}
            />
            <TagsInput
              size="xs"
              label="Symbols"
              placeholder={s.symbols.length ? '' : 'e.g. AAPL'}
              splitChars={[',', ' ']}
              value={s.symbols}
              error={s.symbols.length ? undefined : 'Add a symbol'}
              onChange={(list) =>
                update(i, { symbols: [...new Set(list.map((x) => x.trim().toUpperCase()))] })
              }
            />
          </SimpleGrid>
          <ParamInputs
            strategy={byName.get(s.strategy)}
            values={s.params}
            errors={backtestErrors(byName.get(s.strategy), s.params, s.symbols.length || 1)}
            onChange={(param, value) => update(i, { params: { ...s.params, [param]: value } })}
          />
        </Paper>
      ))}
      <Group justify="space-between">
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={add}
          disabled={sleeves.length >= MAX_SLEEVES}
        >
          Add sleeve
        </Button>
        <Text size="xs" c={total > 100 ? 'red' : 'dimmed'}>
          {total > 100
            ? `${total}% given out: at most 100%`
            : `${total}% invested · ${Math.round((100 - total) * 10) / 10}% stays in cash`}
        </Text>
      </Group>
      <SimpleGrid cols={2} spacing="xs">
        <NumberInput
          label={
            <ParamLabel
              name="Portfolio stop"
              description="When the whole portfolio falls this % below its highest value, everything is sold and no new buys are made for a while. A safety net for big crashes. 0 turns it off."
            />
          }
          suffix="%"
          min={0}
          max={99}
          {...form.getInputProps('maxDrawdownPct')}
        />
        <NumberInput
          label="Pause after a stop"
          suffix=" days"
          min={0}
          max={365}
          {...form.getInputProps('cooldownDays')}
        />
      </SimpleGrid>
    </Stack>
  );
}
