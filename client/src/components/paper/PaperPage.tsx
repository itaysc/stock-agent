import { Alert, Center, Grid, Loader, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { DeploymentView, PaperAccount } from '../../api/paper-types';
import type { Basket } from '../../api/research-types';
import { money } from '../../lib/format';
import { StatCard } from '../results/StatCard';
import { DeploymentCard } from './DeploymentCard';
import { AutopilotPanel } from './AutopilotPanel';
import { DeploymentDetail } from './DeploymentDetail';

const REFRESH_MS = 30_000;

/** The paper-trading dashboard: the account, every deployment, and one in detail. */
export function PaperPage({ selectId, baskets }: { selectId: string | null; baskets: Basket[] }) {
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [list, setList] = useState<DeploymentView[] | null>(null);
  const [selected, setSelected] = useState<string | null>(selectId);
  const [detail, setDetail] = useState<DeploymentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, l] = await Promise.all([api.paperAccount(), api.deployments()]);
      setAccount(a);
      setList(l);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => setSelected((s) => selectId ?? s), [selectId]);
  const current =
    selected ?? list?.find((d) => d.status !== 'stopped')?.id ?? list?.[0]?.id ?? null;
  useEffect(() => {
    if (current) api.deployment(current).then(setDetail, () => setDetail(null));
    else setDetail(null);
  }, [current, list]);

  if (error)
    return (
      <Alert color="red" title="Can't load paper trading">
        {error}
      </Alert>
    );
  if (!account || !list)
    return (
      <Center mih={300}>
        <Loader />
      </Center>
    );
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Paper trading</Title>
        <Text c="dimmed" size="sm">
          Strategies trading fake money on your Alpaca paper account, one trading day at a time,
          compared with what their backtest expected.
        </Text>
      </div>
      {!account.runnerOn && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconInfoCircle />}
          title="The paper runner is off"
        >
          Deployments are saved but not traded: set PAPER_TRADING_ENABLED=true (and use a paper
          account) in server/.env.
        </Alert>
      )}
      <Text size="xs" c="dimmed">
        Real-time news check sources: headlines (Alpaca/Benzinga) ✓ · trading halts (Nasdaq) ✓ · SEC
        filings {account.newsSources.secFilings ? '✓' : '✗ set SEC_USER_AGENT in server/.env'} · AI
        reader {account.newsSources.ai ? '✓' : '✗ set OPENAI_API_KEY'}
      </Text>
      <AutopilotPanel baskets={baskets} onChanged={() => void load()} />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard
          label="Paper cash"
          value={money(account.cash)}
          hint={account.paper ? 'paper account' : 'LIVE account'}
        />
        <StatCard label="Given to deployments" value={money(account.committed)} />
        <StatCard label="Free to deploy" value={money(account.free)} />
        <StatCard label="Deployments worth" value={money(account.deploymentsEquity)} />
      </SimpleGrid>
      {list.length === 0 ? (
        <Paper p="xl">
          <Text c="dimmed" ta="center">
            Nothing deployed yet. Turn on the autopilot, or in the Lab use <b>Paper trade this</b>{' '}
            on a backtest, a portfolio, or an AI research result.
          </Text>
        </Paper>
      ) : (
        <Grid gap="lg" align="flex-start">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="sm">
              {list.map((d) => (
                <DeploymentCard
                  key={d.id}
                  d={d}
                  selected={d.id === current}
                  onSelect={() => setSelected(d.id)}
                />
              ))}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            {detail && (
              <DeploymentDetail
                d={detail}
                onChange={(d) => {
                  setDetail(d);
                  void load();
                }}
              />
            )}
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
