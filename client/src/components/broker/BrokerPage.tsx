import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { BrokerView } from '../../api/broker-types';
import type { PaperAccount } from '../../api/paper-types';
import { money, pct, tone } from '../../lib/format';
import { StatCard } from '../results/StatCard';
import { BrokerActivity } from './BrokerActivity';
import { BrokerHoldings } from './BrokerHoldings';
import { BrokerStart } from './BrokerStart';

const STATUS = {
  active: { color: 'teal', label: 'Trading' },
  paused: { color: 'orange', label: 'Paused' },
  stopped: { color: 'gray', label: 'Stopped' },
} as const;

/** The broker: one pot of paper money it trades by itself, and why it did each trade. */
export function BrokerPage() {
  const [view, setView] = useState<BrokerView | null>(null);
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [v, a] = await Promise.all([api.broker(), api.paperAccount()]);
      setView(v);
      setAccount(a);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);
  const act = async (action: 'start' | 'pause' | 'resume' | 'stop', capital?: number) => {
    try {
      setError(null);
      setView(await api.brokerAction(action, capital));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!view)
    return error ? (
      <Alert color="red">{error}</Alert>
    ) : (
      <Center h={300}>
        <Loader />
      </Center>
    );
  return (
    <Stack gap="lg">
      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {account && !account.runnerOn && (
        <Alert color="orange" title="It can't trade yet">
          Set PAPER_TRADING_ENABLED=true in server/.env (with a paper account) and restart the
          server.
        </Alert>
      )}
      {account && !account.notifications.includes('telegram') && (
        <Text size="xs" c="dimmed">
          Tip: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in server/.env for the daily report on your
          phone.
        </Text>
      )}
      {view.status === 'off' ? (
        <BrokerStart view={view} free={account?.free ?? null} onStart={(c) => act('start', c)} />
      ) : (
        <>
          <Group justify="space-between" align="flex-end">
            <div>
              <Group gap="xs">
                <Title order={2}>Your broker</Title>
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
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={() => void act('resume')}
                >
                  Resume
                </Button>
              )}
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconPlayerStop size={16} />}
                onClick={() => {
                  if (window.confirm('Sell everything and stop the broker?')) void act('stop');
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
            <StatCard
              label="Cash"
              value={money(view.cash)}
              hint={`${view.holdings.length} stocks held`}
            />
          </SimpleGrid>
          <BrokerHoldings holdings={view.holdings} planned={view.planned} params={view.params} />
          <BrokerActivity items={view.activity} />
          <Paper p="md" withBorder>
            <Stack gap={4}>
              <Title order={5}>How it decides</Title>
              <Text size="sm">{view.algo}</Text>
              <Text size="sm" c="dimmed">
                Before each buy it reads the latest news, trading halts and SEC filings, and skips
                the buy on bad news. If it falls {view.maxDrawdownPct}% below its peak it sells
                everything and pauses until you resume it. Every month it checks that the algo still
                beats holding the stocks, and warns you if not.
              </Text>
              {view.lastTune && (
                <Text size="xs" c="dimmed">
                  Last check ({new Date(view.lastTune.at).toLocaleDateString()}):{' '}
                  {view.lastTune.message}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {view.tested}
              </Text>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  );
}
