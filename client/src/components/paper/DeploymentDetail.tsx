import { Alert, Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '../../api/client';
import type { DeploymentView } from '../../api/paper-types';
import { money, pct, tone } from '../../lib/format';
import { StatCard } from '../results/StatCard';
import { EquityLine } from './EquityLine';
import { SleevesTable } from './SleevesTable';
import { HEALTH, STATUS_COLOR } from './status';

const when = (iso: string) => new Date(iso).toLocaleString();

export function DeploymentDetail({
  d,
  onChange,
}: {
  d: DeploymentView;
  onChange: (d: DeploymentView) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: 'pause' | 'resume' | 'stop' | 'run') => {
    if (
      action === 'stop' &&
      !window.confirm('Sell everything this deployment holds and stop it for good?')
    )
      return;
    setBusy(action);
    setError(null);
    try {
      onChange(await api.deploymentAction(d.id, action));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const e = d.expectation;
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <Title order={3}>{d.name}</Title>
            <Badge variant="light" color={STATUS_COLOR[d.status]}>
              {d.status}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Started {when(d.createdAt)} · last trading day seen{' '}
            {d.lastBarAt ? d.lastBarAt.slice(0, 10) : 'none yet'}
          </Text>
        </div>
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            loading={busy === 'run'}
            onClick={() => act('run')}
            disabled={d.status === 'stopped'}
          >
            Check now
          </Button>
          {d.status === 'active' && (
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconPlayerPause size={14} />}
              loading={busy === 'pause'}
              onClick={() => act('pause')}
            >
              Pause
            </Button>
          )}
          {d.status === 'paused' && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlayerPlay size={14} />}
              loading={busy === 'resume'}
              onClick={() => act('resume')}
            >
              Resume
            </Button>
          )}
          {d.status !== 'stopped' && (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconPlayerStop size={14} />}
              loading={busy === 'stop'}
              onClick={() => act('stop')}
            >
              Stop & sell all
            </Button>
          )}
        </Group>
      </Group>
      <Text size="xs" c="dimmed">
        News check:{' '}
        {d.newsCheck
          ? `${d.newsCheck.tone > 0 ? `skip buys on news tone ≤ −${d.newsCheck.tone}` : 'no tone check'}; AI ${d.newsCheck.ai ? 'reads the headlines too' : 'off'}; breaking news on holdings: ${{ off: 'ignored', alert: 'alert', sell: 'sell' }[d.newsCheck.watch]}`
          : 'off (deployed before news checks existed)'}
      </Text>
      {d.statusReason && (
        <Alert variant="light" color={STATUS_COLOR[d.status]}>
          {d.statusReason}
        </Alert>
      )}
      {error && <Alert color="red">{error}</Alert>}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard
          label="Now"
          value={money(d.equity)}
          color={tone(d.pnl)}
          hint={`${d.pnl >= 0 ? '+' : '−'}${money(Math.abs(d.pnl))} from ${money(d.capital)}`}
        />
        <StatCard
          label="Below its peak"
          value={`${d.drawdownPct.toFixed(1)}%`}
          hint={`guard pauses at ${d.maxDrawdownPct}%`}
        />
        <StatCard
          label="Live, a year"
          value={pct(d.liveAnnualPct)}
          hint={`expected ${pct(e?.annualPct)} (backtest)`}
        />
        <StatCard
          label="Backtest's worst drop"
          value={e ? `${e.maxDrawdownPct.toFixed(1)}%` : 'n/a'}
          hint={`${e ? Math.round(e.tradesPerYear) : 0} trades a year expected`}
        />
      </SimpleGrid>
      <Paper p="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            Money over time
          </Text>
          <Text size="xs" c={HEALTH[d.health].color}>
            {d.healthText}
          </Text>
        </Group>
        <EquityLine points={d.snapshots ?? []} capital={d.capital} />
      </Paper>
      <SleevesTable sleeves={d.sleeves} />
      <Paper p="md">
        <Text fw={600} size="sm" mb="xs">
          What happened
        </Text>
        <Stack gap={4}>
          {(d.events ?? []).slice(0, 30).map((ev) => (
            <Text key={`${ev.timestamp}-${ev.message}`} size="sm">
              <Text span size="xs" c="dimmed">
                {when(ev.timestamp)}
              </Text>{' '}
              {ev.message}
            </Text>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
