import { Alert, Button, Group, Modal, NumberInput, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { BrokerHolding } from '../../api/broker-types';

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Your own stop loss and profit target for one holding, with quick picks. */
export function LevelsModal({
  holding,
  onClose,
  onSave,
}: {
  holding: BrokerHolding | null;
  onClose: () => void;
  onSave: (levels: { stopPrice: number | null; takeProfitPrice: number | null }) => Promise<void>;
}) {
  const [stop, setStop] = useState<number | ''>('');
  const [take, setTake] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStop(holding?.stopIsYours && holding.stopPrice ? round(holding.stopPrice) : '');
    setTake(holding?.takeIsYours && holding.takeProfitPrice ? round(holding.takeProfitPrice) : '');
    setError(null);
  }, [holding]);
  if (!holding) return null;
  const at = (pct: number) => round(holding.price * (1 + pct / 100));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        stopPrice: stop === '' ? null : stop,
        takeProfitPrice: take === '' ? null : take,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened onClose={onClose} title={`Your levels for ${holding.symbol}`}>
      <Stack gap="sm">
        <Text size="sm">
          Bought at {usd(holding.entryPrice)}, now {usd(holding.price)}. Checked on each day's
          close; a sale fills at the next open.
        </Text>
        <NumberInput
          label="Stop loss: sell if it closes below"
          description={`Automatic stop: ${holding.autoStopPrice ? usd(holding.autoStopPrice) : 'none'} (the higher one counts). Empty = automatic only.`}
          prefix="$"
          decimalScale={2}
          min={0}
          value={stop}
          onChange={(v) => setStop(v === '' ? '' : Number(v))}
        />
        <Group gap={6}>
          {[-3, -5, -10].map((p) => (
            <Button
              key={p}
              size="compact-xs"
              variant="light"
              color="red"
              onClick={() => setStop(at(p))}
            >
              {p}% from now
            </Button>
          ))}
          {holding.entryPrice < holding.price && (
            <Button
              size="compact-xs"
              variant="light"
              color="red"
              onClick={() => setStop(round(holding.entryPrice))}
            >
              at my buy price (no loss)
            </Button>
          )}
        </Group>
        <NumberInput
          label="Take profit: sell if it closes above"
          description="Empty = no target (winners keep running)."
          prefix="$"
          decimalScale={2}
          min={0}
          value={take}
          onChange={(v) => setTake(v === '' ? '' : Number(v))}
        />
        <Group gap={6}>
          {[5, 10, 20].map((p) => (
            <Button
              key={p}
              size="compact-xs"
              variant="light"
              color="teal"
              onClick={() => setTake(at(p))}
            >
              +{p}% from now
            </Button>
          ))}
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
