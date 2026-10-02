import { Badge, Button, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { BrokerOverview, InvestmentView } from '../../api/broker-types';
import { money, pct, tone } from '../../lib/format';
import { StatCard } from '../results/StatCard';
import { BrokerActivity } from './BrokerActivity';
import { BrokerHoldings } from './BrokerHoldings';
import { BrokerHow } from './BrokerHow';

const STATUS = {
  active: { color: 'teal', label: 'Trading' },
  paused: { color: 'orange', label: 'Paused' },
  stopped: { color: 'gray', label: 'Stopped' },
} as const;

/** One investment: its value vs SPY, controls, holdings, what it did, and how it decides. */
export function InvestmentPanel({
  view,
  onOverview,
  onError,
}: {
  view: InvestmentView;
  onOverview: (o: BrokerOverview) => void;
  onError: (message: string) => void;
}) {
  const act = async (action: 'pause' | 'resume' | 'stop') => {
    try {
      onOverview(await api.brokerInvestment(view.deploymentId, action));
    } catch (err) {
      onError((err as Error).message);
    }
  };
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Group gap="xs">
            <Title order={2}>{view.name}</Title>
            <Badge variant="light" color={STATUS[view.status].color}>
              {STATUS[view.status].label}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Paper money since {new Date(view.startedAt).toLocaleDateString()}
            {view.statusReason ? ` · ${view.statusReason}` : ''}
          </Text>
        </div>
        <Group gap="xs">
          {view.status === 'active' ? (
            <Button
              variant="default"
              leftSection={<IconPlayerPause size={16} />}
              onClick={() => void act('pause')}
            >
              Pause
            </Button>
          ) : (
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => void act('resume')}>
              Resume
            </Button>
          )}
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconPlayerStop size={16} />}
            onClick={() => {
              if (window.confirm(`Sell everything in "${view.name}" and stop it?`))
                void act('stop');
            }}
          >
            Stop &amp; sell all
          </Button>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard
          label="Worth now"
          value={money(view.equity)}
          hint={`started with ${money(view.capital)}`}
        />
        <StatCard
          label="Gain"
          value={pct(view.pnlPct)}
          color={tone(view.pnlPct)}
          hint={money(view.pnl)}
        />
        <StatCard
          label="SPY, same time"
          value={pct(view.spyPct)}
          color={tone(view.spyPct)}
          hint={
            view.spyPct === null
              ? 'no data yet'
              : view.pnlPct >= view.spyPct
                ? 'it is ahead of SPY'
                : 'it is behind SPY'
          }
        />
        <StatCard label="Cash" value={money(view.cash)} hint={`${view.holdings.length} holdings`} />
      </SimpleGrid>
      <BrokerHoldings
        investmentId={view.deploymentId}
        holdings={view.holdings}
        planned={view.planned}
        params={view.params}
        noBuyUntil={view.noBuyUntil ?? []}
        onOverview={onOverview}
      />
      <BrokerActivity items={view.activity} />
      <BrokerHow view={view} />
    </Stack>
  );
}
