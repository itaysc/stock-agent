import { Alert, Button, Group, NumberInput, Paper, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconRobot, IconSparkles } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { BrokerPlan, BrokerProfiles, BrokerView } from '../../api/broker-types';
import { money } from '../../lib/format';
import { BrokerPlanTable } from './BrokerPlanTable';
import { ProfilePicker } from './ProfilePicker';
import { SellRules } from './SellRules';

/** 1. how much; 2. how much risk (with the history in $); 3. the suggested spread; 4. your approval. */
export function BrokerStart({
  view,
  free,
  onStart,
}: {
  view: BrokerView;
  free: number | null;
  onStart: (capital: number, profile: string) => Promise<void>;
}) {
  const [capital, setCapital] = useState<number>(1_000);
  const [profiles, setProfiles] = useState<BrokerProfiles | null>(null);
  const [profile, setProfile] = useState<string>('');
  /** You picked a profile yourself: a new amount no longer switches it to the suggestion. */
  const [picked, setPicked] = useState(false);
  // The plan and what it was made for (a stale answer for another amount or profile is not shown).
  const [planFor, setPlanFor] = useState<{
    plan: BrokerPlan;
    capital: number;
    profile: string;
  } | null>(null);
  const plan =
    planFor && planFor.capital === capital && planFor.profile === profile ? planFor.plan : null;
  const [busy, setBusy] = useState<'plan' | 'start' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The options (and the suggestion) follow the amount.
  useEffect(() => {
    if (capital < 100) return;
    const t = setTimeout(() => {
      api.brokerProfiles(capital).then(
        (p) => {
          setProfiles(p);
          if (!picked) setProfile(p.suggested.profile);
        },
        (err: Error) => setError(err.message),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [capital, picked]);
  const suggest = async () => {
    setBusy('plan');
    setError(null);
    try {
      const asked = { capital, profile };
      setPlanFor({ plan: await api.brokerPreview(asked.capital, asked.profile), ...asked });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const chosen = profiles?.profiles.find((p) => p.id === profile);
  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group gap="sm">
          <IconRobot size={28} />
          <Title order={3}>Let the broker invest for you</Title>
        </Group>
        <Text>
          Enter an amount and choose how much risk you accept. It shows what each choice did since
          2007 in dollars for your amount, suggests how to spread the money, and once you approve it
          buys at the next open and runs everything.
        </Text>
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
          onChange={(v) => setCapital(Number(v) || 0)}
        />
        {profiles && (
          <ProfilePicker
            data={profiles}
            selected={profile}
            onSelect={(id) => {
              setProfile(id);
              setPicked(true);
            }}
          />
        )}
        <Group>
          <Button
            variant={plan ? 'default' : 'filled'}
            leftSection={<IconSparkles size={16} />}
            loading={busy === 'plan'}
            disabled={capital < 100 || !profile}
            onClick={() => void suggest()}
          >
            {plan ? 'Suggest again' : `Suggest a plan${chosen ? ` (${chosen.name})` : ''}`}
          </Button>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        {plan && chosen && (
          <Stack gap="sm">
            <Title order={5}>
              {chosen.name} plan for {money(plan.capital)} (prices of{' '}
              {new Date(plan.asOf).toLocaleDateString()})
            </Title>
            <BrokerPlanTable plan={plan} />
            {plan.cash >= 1 && (
              <Text size="xs" c="dimmed">
                {money(plan.cash)} stays in cash.
              </Text>
            )}
            <SellRules
              params={
                chosen.id === 'aggressive' ? view.params : { ...view.params, marketFilter: '200' }
              }
            />
            <Text size="xs" c="dimmed">
              It buys at the next market open, so prices (and shares) will differ a little; a stock
              with bad news before the open is skipped. If the account falls {chosen.alertPct}% from
              its peak, it asks you in Telegram whether to sell everything.
            </Text>
            <Group>
              <Button
                color="teal"
                leftSection={<IconCheck size={16} />}
                loading={busy === 'start'}
                onClick={() => {
                  setBusy('start');
                  void onStart(capital, profile).finally(() => setBusy(null));
                }}
              >
                Approve and invest {money(plan.capital)} ({chosen.name})
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
