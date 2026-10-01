import { Group, Switch, Text, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { FormValues } from '../../lib/form';
import { durationLabel, parseDuration, windowCount } from '../../lib/walkForward';
import { ParamLabel } from './ParamLabel';

interface Props {
  form: UseFormReturnType<FormValues>;
}

const hint = (value: string) => {
  const d = parseDuration(value);
  return d ? durationLabel(d) : undefined;
};

export function WalkForwardFields({ form }: Props) {
  const v = form.values;
  const windows = windowCount(v);
  const invalid = (value: string) =>
    parseDuration(value) ? undefined : 'Like 90d, 26w, 12m or 2y';
  return (
    <div>
      <Group grow gap="xs" align="flex-start">
        <TextInput
          label={
            <ParamLabel
              name="Training"
              description="How much history each window uses to pick the best settings. More = steadier picks, but slower to adapt."
            />
          }
          description={hint(v.train)}
          placeholder="12m"
          error={invalid(v.train)}
          {...form.getInputProps('train')}
        />
        <TextInput
          label={
            <ParamLabel
              name="Test"
              description="How long the picked settings are then traded on unseen data before picking again. Also how far each window moves."
            />
          }
          description={hint(v.test)}
          placeholder="3m"
          error={invalid(v.test)}
          {...form.getInputProps('test')}
        />
      </Group>
      <Switch
        mt="sm"
        label="Anchored"
        description="Training always starts at the beginning and grows, instead of a fixed-length window that slides"
        {...form.getInputProps('anchored', { type: 'checkbox' })}
      />
      {windows !== null && (
        <Text size="xs" mt="xs" c={windows === 0 ? 'red' : 'dimmed'}>
          {windows === 0
            ? 'The period is too short: it needs more than one training length before the first test.'
            : `${windows} test window${windows === 1 ? '' : 's'} of unseen data${windows < 4 ? ' (few: a longer period gives a more reliable result)' : ''}`}
        </Text>
      )}
    </div>
  );
}
