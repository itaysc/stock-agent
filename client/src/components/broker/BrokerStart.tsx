import { Alert, Button, Group, NumberInput, Paper, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconRobot, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '../../api/client';
import type { BrokerPlan, BrokerView } from '../../api/broker-types';
import { money } from '../../lib/format';
import { BrokerPlanTable } from './BrokerPlanTable';
import { SellRules } from './SellRules';

/** Step 1: how much. Step 2: the suggested spread. Step 3: your approval starts it. */
export function BrokerStart({
  view,
  free,
  onStart,
}: {
  view: BrokerView;
  free: number | null;
  onStart: (capital: number) => Promise<void>;
}) {
  const [capital, setCapital] = useState<number>(1_000);
  const [plan, setPlan] = useState<BrokerPlan | null>(null);
  const [busy, setBusy] = useState<'plan' | 'start' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suggest = async () => {
    setBusy('plan');
    setError(null);
    try {
      setPlan(await api.brokerPreview(capital));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const approve = async () => {
    setBusy('start');
    await onStart(capital).finally(() => setBusy(null));
  };
  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group gap="sm">
          <IconRobot size={28} />
          <Title order={3}>Let the broker invest for you</Title>
        </Group>
        <Text>
          Enter an amount and it suggests how to spread it over {view.universe.length - 1} of the
          biggest US stocks. When you approve, it buys at the next open and then runs everything:
          the stops, the weekly re-checks, the news checks, and a daily report.
        </Text>
        <Group align="flex-end">
          <NumberInput
            label="How much paper money?"
            description={free === null ? undefined : `free to invest: ${money(free)}`}
            prefix="$"
            thousandSeparator=","
            min={100}
            max={free ?? undefined}
            step={100}
            w={220}
            value={capital}
            onChange={(v) => {
              setCapital(Number(v) || 0);
              setPlan(null);
            }}
          />
          <Button
            variant={plan ? 'default' : 'filled'}
            leftSection={<IconSparkles size={16} />}
            loading={busy === 'plan'}
            disabled={capital < 100}
            onClick={() => void suggest()}
          >
            {plan ? 'Suggest again' : 'Suggest a plan'}
          </Button>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        {plan && (
          <Stack gap="sm">
            <Title order={5}>
              Suggested plan for {money(plan.capital)} (prices of{' '}
              {new Date(plan.asOf).toLocaleDateString()})
            </Title>
            <BrokerPlanTable plan={plan} />
            {plan.cash >= 1 && (
              <Text size="xs" c="dimmed">
                {money(plan.cash)} stays in cash.
              </Text>
            )}
            <SellRules params={view.params} />
            <Text size="xs" c="dimmed">
              It buys at the next market open, so prices (and shares) will differ a little; a stock
              with bad news before the open is skipped. {view.tested}
            </Text>
            <Group>
              <Button
                color="teal"
                leftSection={<IconCheck size={16} />}
                loading={busy === 'start'}
                onClick={() => void approve()}
              >
                Approve and invest {money(plan.capital)}
              </Button>
              <Text size="xs" c="dimmed">
                Paper money only. Pause or stop any time.
              </Text>
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
