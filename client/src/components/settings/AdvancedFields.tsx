import { NumberInput, Select, SimpleGrid, Stack } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { BacktestOptions, SortKey } from '../../api/types';
import type { FormValues } from '../../lib/form';
import { ParamLabel } from './ParamLabel';

const SORT_LABELS: Record<SortKey, string> = {
  return: 'Highest return',
  drawdown: 'Smallest drawdown',
  'profit-factor': 'Highest profit factor',
  'return-dd': 'Best return per drawdown',
};

interface Props {
  form: UseFormReturnType<FormValues>;
  options: BacktestOptions;
}

export function AdvancedFields({ form, options }: Props) {
  const mode = form.values.mode;
  const sortData = options.sortKeys.map((k) => ({
    value: k,
    label: SORT_LABELS[k],
  }));
  return (
    <Stack gap="sm">
      <NumberInput
        label="Starting cash"
        prefix="$"
        thousandSeparator=","
        min={100}
        step={10_000}
        {...form.getInputProps('cash')}
      />
      <SimpleGrid cols={2} spacing="xs">
        <NumberInput
          label="Slippage"
          description="Per fill"
          suffix=" bps"
          min={0}
          max={500}
          {...form.getInputProps('slippageBps')}
        />
        <NumberInput
          label="Fee"
          description="Per share"
          prefix="$"
          min={0}
          decimalScale={4}
          step={0.001}
          {...form.getInputProps('feePerShare')}
        />
      </SimpleGrid>
      <NumberInput
        label={
          <ParamLabel
            name="Interest on idle cash"
            description="While the strategy is out of the market, its cash earns this yearly rate, like a broker's cash sweep or a money-market fund. Buy & hold is always invested, so this keeps the comparison fair. 0 turns it off."
          />
        }
        suffix="% a year"
        min={0}
        max={20}
        decimalScale={2}
        step={0.5}
        clampBehavior="strict"
        {...form.getInputProps('cashYieldPct')}
      />
      <NumberInput
        label={
          <ParamLabel
            name="Skip buys on bad overnight news"
            description="Before a buy fills at the open, look at the headlines since the last close: skip it when they average this negative or worse (tone -1 to +1; 0.3 = clearly negative). 0 = off. Fetches the symbols' news."
          />
        }
        min={0}
        max={1}
        step={0.05}
        decimalScale={2}
        clampBehavior="strict"
        placeholder="off"
        {...form.getInputProps('newsGateTone')}
      />
      {(mode === 'sweep' || mode === 'walkforward') && (
        <SimpleGrid cols={2} spacing="xs">
          <Select
            label={mode === 'sweep' ? 'Rank by' : 'Pick best by'}
            description={mode === 'sweep' ? undefined : 'In each training window'}
            data={sortData}
            allowDeselect={false}
            {...form.getInputProps(mode === 'sweep' ? 'sort' : 'wfSort')}
          />
          <NumberInput
            label="Min trades"
            description={mode === 'sweep' ? 'Hide runs below' : 'Needed to be picked'}
            min={0}
            {...form.getInputProps('minTrades')}
          />
        </SimpleGrid>
      )}
    </Stack>
  );
}
