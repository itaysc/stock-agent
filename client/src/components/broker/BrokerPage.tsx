import { Alert, Center, Loader, Stack, Tabs, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { BrokerOverview } from '../../api/broker-types';
import type { PaperAccount } from '../../api/paper-types';
import { money, pct } from '../../lib/format';
import { applyLive, type LivePrices } from '../../lib/live';
import { AllInvestments } from './AllInvestments';
import { BrokerStart } from './BrokerStart';
import { DataTimes } from './DataTimes';
import { FundsLine } from './FundsLine';
import { InvestmentPanel } from './InvestmentPanel';

/** How often the page reloads its data, and fetches the live prices. */
const PAGE_MS = 60_000;
const LIVE_MS = 10 * 60_000;

/** The newest of some dates (ISO strings), or null. */
const latest = (dates: Array<string | null>) =>
  dates.reduce<string | null>((a, b) => (b && (!a || b > a) ? b : a), null);

/** The broker: your investments (one tab each), the money still free, and a tab to add another. */
export function BrokerPage() {
  const [overview, setOverview] = useState<BrokerOverview | null>(null);
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LivePrices>({});
  // When the page and the live prices were last loaded (shown in DataTimes).
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [liveCheckedAt, setLiveCheckedAt] = useState<Date | null>(null);
  // Bumped by "Refresh now": reloads everything at once and restarts both timers.
  const [round, setRound] = useState(0);
  const load = useCallback(async () => {
    try {
      const [o, a] = await Promise.all([api.broker(), api.paperAccount()]);
      setOverview(o);
      setAccount(a);
      setLoadedAt(new Date());
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), PAGE_MS);
    return () => clearInterval(timer);
  }, [load, round]);
  // ~Live prices: on opening the page (and whenever the stocks held change), then every 10 minutes.
  const held = [
    ...new Set(overview?.investments.flatMap((v) => v.holdings.map((h) => h.symbol)) ?? []),
  ]
    .sort()
    .join(',');
  useEffect(() => {
    if (!held) return;
    // After "Refresh now" the first fetch skips the server's one-minute cache.
    let fresh = round > 0;
    const fetchLive = () =>
      void api.brokerPrices(held.split(','), fresh).then(
        (r) => {
          setLive(r.prices);
          setLiveCheckedAt(new Date());
        },
        () => undefined, // keep showing the last closes
      );
    fetchLive();
    fresh = false;
    const timer = setInterval(fetchLive, LIVE_MS);
    return () => clearInterval(timer);
  }, [held, round]);
  // After a change, the money figures change too.
  const changed = (o: BrokerOverview) => {
    setOverview(o);
    void api.paperAccount().then(setAccount, () => undefined);
  };

  if (!overview)
    return error ? (
      <Alert color="red">{error}</Alert>
    ) : (
      <Center h={300}>
        <Loader />
      </Center>
    );
  const list = overview.investments.map((v) => applyLive(v, live));
  const free = account?.free ?? null;
  const canAdd = free === null || free >= 100;
  const start = (
    <BrokerStart
      view={overview}
      free={free}
      onStart={async (capital, profile) => {
        try {
          setError(null);
          const o = await api.brokerStart(capital, profile);
          changed(o);
          setTab(o.investments.at(-1)?.deploymentId ?? null);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    />
  );
  // With two or more, "All" comes first and is where it opens.
  const many = list.length > 1;
  const current =
    list.some((v) => v.deploymentId === tab) || tab === 'add' || (many && tab === 'all')
      ? tab
      : many
        ? 'all'
        : (list[0]?.deploymentId ?? null);
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
      {account && <FundsLine account={account} />}
      <DataTimes
        closesAsOf={latest(list.map((v) => v.closesAsOf))}
        liveTradeAt={latest(Object.values(live).map((l) => l.at))}
        liveCheckedAt={liveCheckedAt}
        pageAt={loadedAt}
        nextPageAt={loadedAt && new Date(loadedAt.getTime() + PAGE_MS)}
        nextLiveAt={held && liveCheckedAt ? new Date(liveCheckedAt.getTime() + LIVE_MS) : null}
        onRefresh={() => setRound((r) => r + 1)}
      />
      {list.length === 0 ? (
        start
      ) : (
        <Tabs value={current} onChange={setTab} keepMounted={false}>
          <Tabs.List>
            {many && <Tabs.Tab value="all">All</Tabs.Tab>}
            {list.map((v) => (
              <Tabs.Tab
                key={v.deploymentId}
                value={v.deploymentId}
                rightSection={
                  <Text size="xs" c={v.pnlPct >= 0 ? 'teal' : 'red'}>
                    {pct(v.pnlPct)}
                  </Text>
                }
              >
                {v.name}
              </Tabs.Tab>
            ))}
            <Tabs.Tab value="add" leftSection={<IconPlus size={14} />} disabled={!canAdd}>
              Add investment{free !== null ? ` (${money(free)} free)` : ''}
            </Tabs.Tab>
          </Tabs.List>
          {many && (
            <Tabs.Panel value="all" pt="md">
              <AllInvestments list={list} onOpen={setTab} />
            </Tabs.Panel>
          )}
          {list.map((v) => (
            <Tabs.Panel key={v.deploymentId} value={v.deploymentId} pt="md">
              <InvestmentPanel view={v} onOverview={changed} onError={setError} />
            </Tabs.Panel>
          ))}
          <Tabs.Panel value="add" pt="md">
            {start}
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}
