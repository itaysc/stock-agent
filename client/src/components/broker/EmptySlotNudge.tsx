import { Alert, Button, Group, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { BrokerOverview, NextInLine } from '../../api/broker-types';
import { pct } from '../../lib/format';

/** A reminder that a place is empty since you sold a stock, with the next in line to buy for it. */
export function EmptySlotNudge({
  investmentId,
  emptySlots,
  topN,
  onOverview,
}: {
  investmentId: string;
  emptySlots: number;
  topN: number;
  onOverview: (o: BrokerOverview) => void;
}) {
  const [next, setNext] = useState<NextInLine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (emptySlots > 0)
      void api.brokerNextInLine(investmentId).then(
        (r) => setNext(r.candidates),
        () => setNext([]),
      );
  }, [investmentId, emptySlots]);
  if (!(emptySlots > 0)) return null;
  const fill = async (symbol: string) => {
    setBusy(symbol);
    setError(null);
    try {
      onOverview(await api.brokerFillSlot(investmentId, symbol));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Alert
      color="yellow"
      title={`${emptySlots === 1 ? 'A place is' : `${emptySlots} places are`} empty`}
    >
      <Text size="sm">
        You sold a stock and left its place empty: {topN - emptySlots} of {topN} places are working,
        and the money for the rest waits in T-bills. Pick a stock so the broker works with all{' '}
        {topN} again:
      </Text>
      <Group gap="xs" mt="xs">
        {next.map((c) => (
          <Button
            key={c.symbol}
            size="xs"
            variant="light"
            loading={busy === c.symbol}
            disabled={!!busy && busy !== c.symbol}
            onClick={() => void fill(c.symbol)}
          >
            Buy {c.symbol} (#{c.rank}, {pct(c.momentumPct)})
          </Button>
        ))}
      </Group>
      {error && (
        <Text size="sm" c="red" mt="xs">
          {error}
        </Text>
      )}
    </Alert>
  );
}
