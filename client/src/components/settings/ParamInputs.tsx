import { NumberInput, SimpleGrid } from '@mantine/core';
import type { ParamInfo, StrategyInfo } from '../../api/types';
import { ParamLabel } from './ParamLabel';

export const placeholder = (p: ParamInfo) =>
  p.default === null
    ? 'auto: 1 / symbols'
    : p.zeroIsOff && p.default === 0
      ? 'off'
      : `default ${p.default}`;

/** Step for the +/- buttons: whole numbers, or 0.05 for fractions like allocation. */
const step = (p: ParamInfo) => (p.integer ? 1 : (p.max ?? Infinity) <= 1 ? 0.05 : 1);

interface Props {
  strategy: StrategyInfo | undefined;
  values: Record<string, string> | undefined;
  errors: Record<string, string>;
  onChange: (param: string, value: string) => void;
}

/** One number input per param of a strategy, within its limits ('' = default). */
export function ParamInputs({ strategy, values, errors, onChange }: Props) {
  return (
    <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
      {strategy?.params.map((p) => (
        <NumberInput
          key={p.name}
          label={<ParamLabel name={p.name} description={p.description} />}
          placeholder={placeholder(p)}
          size="xs"
          min={p.min}
          max={p.max}
          step={step(p)}
          allowNegative={p.min < 0}
          allowDecimal={!p.integer}
          decimalScale={p.integer ? 0 : 4}
          clampBehavior="blur"
          error={errors[p.name]}
          value={values?.[p.name] ?? ''}
          onChange={(value) => onChange(p.name, String(value))}
        />
      ))}
    </SimpleGrid>
  );
}
