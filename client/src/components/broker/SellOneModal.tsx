import { Alert, Button, Loader, Modal, Radio, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { BrokerHolding, BrokerOverview, NextInLine } from '../../api/broker-types';
import { money, pct } from '../../lib/format';
import { ModalActions } from '../shared/StickyAction';

const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/**
 * Sell all of one stock and choose what takes its place: the next in line
 * (bought with the money), or nothing for now (its place waits in T-bills
 * while the other stocks keep running, and you're reminded to pick one).
 */
export function SellOneModal({
  investmentId,
  holding,
  onClose,
  onDone,
}: {
  investmentId: string;
  holding: BrokerHolding | null;
  onClose: () => void;
  onDone: (o: BrokerOverview, message: string) => void;
}) {
  const [next, setNext] = useState<NextInLine[] | null>(null);
  const [choice, setChoice] = useState<string>('empty');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setNext(null);
    setError(null);
    if (!holding) return;
    void api.brokerNextInLine(investmentId).then(
      (r) => {
        setNext(r.candidates);
        setChoice(r.candidates[0]?.symbol ?? 'empty');
      },
      () => setNext([]),
    );
  }, [holding, investmentId]);
  if (!holding) return null;
  const sell = async () => {
    setBusy(true);
    setError(null);
    try {
      const replace = choice === 'empty' ? undefined : choice;
      const o = await api.brokerSellOne(investmentId, holding.symbol, replace);
      onDone(
        o,
        replace
          ? `Selling ${holding.symbol}; ${replace} takes its place (bought after the news check, at the next open if the market is closed).`
          : `Selling ${holding.symbol}; its place stays empty until you pick a stock (see the reminder above).`,
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened onClose={onClose} title={`Sell ${holding.symbol}`}>
      <Stack gap="sm">
        <Text size="sm">
          Sells all {shares(holding.qty)} shares (about {money(holding.qty * holding.price)}) at the
          market price, or at the next open when the market is closed. The broker won&apos;t pick{' '}
          {holding.symbol} again for 30 days.
        </Text>
        <Text size="sm" fw={600}>
          What takes its place?
        </Text>
        {!next ? (
          <Loader size="sm" />
        ) : (
          <Radio.Group value={choice} onChange={setChoice}>
            <Stack gap={8}>
              {next.map((c, i) => (
                <Radio
                  key={c.symbol}
                  value={c.symbol}
                  label={`${c.symbol}${i === 0 ? ' (next in line)' : ''}: #${c.rank} of the 50, ${pct(c.momentumPct)} over 12 months, ${money(c.price)}`}
                />
              ))}
              <Radio
                value="empty"
                label="Nothing for now: just sell"
                description="The other stocks keep running; this place's money waits in T-bills, and you're reminded to pick a stock so all 5 places work again."
              />
            </Stack>
          </Radio.Group>
        )}
        {error && <Alert color="red">{error}</Alert>}
        <ModalActions>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" loading={busy} disabled={!next} onClick={() => void sell()}>
            {choice === 'empty'
              ? `Sell ${holding.symbol}`
              : `Sell ${holding.symbol}, buy ${choice}`}
          </Button>
        </ModalActions>
      </Stack>
    </Modal>
  );
}
