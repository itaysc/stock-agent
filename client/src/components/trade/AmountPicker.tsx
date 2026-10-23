import { Chip, Group, NumberInput } from '@mantine/core';
import { useIsMobile } from '../../hooks/useIsMobile';

/** One tap for a usual amount. */
const QUICK = [100, 500, 1000];
const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;

/** The dollar amount to buy or sell: quick amounts (and all the free cash), or any amount typed. */
export function AmountPicker({
  amount,
  free,
  onChange,
}: {
  amount: number | '';
  free: number | null;
  onChange: (amount: number | '') => void;
}) {
  const mobile = useIsMobile();
  return (
    <>
      <Chip.Group value={String(amount)} onChange={(v) => onChange(Number(v as string))}>
        <Group gap="xs">
          {QUICK.map((q) => (
            <Chip key={q} value={String(q)} size={mobile ? 'md' : 'sm'}>
              {dollars(q)}
            </Chip>
          ))}
          {free !== null && free >= 1 && (
            <Chip value={String(Math.floor(free))} size={mobile ? 'md' : 'sm'}>
              All free ({dollars(Math.floor(free))})
            </Chip>
          )}
        </Group>
      </Chip.Group>
      <NumberInput
        label="Amount"
        prefix="$"
        min={1}
        decimalScale={2}
        w={mobile ? '100%' : 140}
        inputMode="decimal"
        hideControls={mobile}
        value={amount}
        onChange={(v) => onChange(v === '' ? '' : Number(v))}
      />
    </>
  );
}
