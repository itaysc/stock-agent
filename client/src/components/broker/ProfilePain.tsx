import { Stack, Text } from '@mantine/core';
import type { ProfilePain as Pain } from '../../api/broker-types';

const years = (months: number) => `${(months / 12).toFixed(1)} years`;

/** How hard a profile was to live with in the test, next to SPY's numbers. */
export function ProfilePain({ pain, spy }: { pain: Pain; spy?: Pain }) {
  const vs = pain.vsSpy3y;
  return (
    <Stack gap={0}>
      <Text size="xs">
        Longest wait to get back to a peak: <b>{years(pain.longestUnderwaterMonths)}</b>
        {spy && ` (SPY ${years(spy.longestUnderwaterMonths)})`}
      </Text>
      <Text size="xs" title="Ulcer index: how deep and how long the drops were. Lower is calmer.">
        Pain score: <b>{pain.ulcerIndex.toFixed(1)}</b>
        {spy && ` (SPY ${spy.ulcerIndex.toFixed(1)})`}, lower is calmer
      </Text>
      <Text size="xs" title="Calmar ratio: the yearly return divided by the worst drop.">
        Return per unit of worst drop: <b>{pain.calmar.toFixed(2)}</b>
        {spy && ` (SPY ${spy.calmar.toFixed(2)})`}
      </Text>
      {vs && (
        <Text size="xs" c={vs.trailedPct > 50 ? 'orange' : 'dimmed'}>
          Did worse than SPY in {vs.trailedPct.toFixed(0)}% of 3-year stretches (at worst{' '}
          {Math.abs(vs.worstGapPct).toFixed(0)} points a year behind)
        </Text>
      )}
    </Stack>
  );
}
