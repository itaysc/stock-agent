import { Group, Text, Tooltip } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PaperAccount } from '../api/paper-types';
import { money } from '../lib/format';

const EVERY_MS = 60_000;

/** The money in stocks and the money still free to invest, in the top bar (updated every minute). */
export function HeaderFunds() {
  const [a, setA] = useState<PaperAccount | null>(null);
  useEffect(() => {
    const load = () => void api.paperAccount().then(setA, () => undefined);
    load();
    const t = setInterval(load, EVERY_MS);
    return () => clearInterval(t);
  }, []);
  if (!a) return null;
  // Everything in stocks: the broker's investments, your own stocks and anything else on the account.
  const invested = Math.max(0, a.equity - a.cash);
  const item = (label: string, value: number, color?: string) => (
    <div>
      <Text size="xs" c="dimmed" lh={1.1}>
        {label}
      </Text>
      <Text size="sm" fw={700} lh={1.2} c={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {money(value)}
      </Text>
    </div>
  );
  return (
    <Tooltip
      label={`Paper account: ${money(a.equity)} in all. Invested = in stocks now; free = cash not given to any investment.`}
      withArrow
    >
      <Group gap="md" wrap="nowrap" visibleFrom="md">
        {item('Invested', invested)}
        {item('Free to invest', a.free, 'teal')}
      </Group>
    </Tooltip>
  );
}
