import { Badge, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import type { BrokerProfile, BrokerProfiles } from '../../api/broker-types';
import { money } from '../../lib/format';
import { periodText, usualRange, vsSpy } from '../../lib/robust';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
const usd = (n: number) => `${n < 0 ? '-' : n > 0 ? '+' : ''}${money(Math.abs(n))}`;

/** The risk profiles side by side, with their history in dollars for your amount; click one to choose it. */
export function ProfilePicker({
  data,
  selected,
  onSelect,
}: {
  data: BrokerProfiles;
  selected: string;
  onSelect: (id: BrokerProfile['id']) => void;
}) {
  const since = data.profiles[0]?.stats
    ? new Date(data.profiles[0].stats.from).getUTCFullYear()
    : null;
  return (
    <Stack gap="xs">
      <Text size="sm">
        <b>How much risk?</b> For {money(data.capital)} the agent suggests{' '}
        <b>{data.profiles.find((p) => p.suggested)?.name}</b>: {data.suggested.why}.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        {data.profiles.map((p) => {
          const on = p.id === selected;
          const s = p.stats;
          const a = p.forAmount;
          return (
            <UnstyledButton key={p.id} onClick={() => onSelect(p.id)}>
              <Paper
                p="sm"
                withBorder
                h="100%"
                style={{
                  borderColor: on ? 'var(--mantine-color-blue-6)' : undefined,
                  borderWidth: on ? 2 : 1,
                }}
              >
                <Stack gap={4}>
                  <Group gap={6}>
                    <Text fw={700}>{p.name}</Text>
                    {p.suggested && (
                      <Badge size="xs" variant="light" color="yellow">
                        ⭐ suggested
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {p.summary}
                  </Text>
                  {s && a && p.robust && a.usualYear && a.worstDropAny !== null ? (
                    <>
                      <Text size="sm">
                        Usually <b>{usualRange(p.robust)}</b> a year in tests (SPY{' '}
                        {pct(s.spy.annualPct)})
                      </Text>
                      <Text size="xs" c="dimmed">
                        For {money(data.capital)}: {usd(a.usualYear[0])} to {usd(a.usualYear[1])} in
                        a usual year
                      </Text>
                      <Text size="sm" c="red">
                        Worst drop: up to {pct(-p.robust.worstDropPct)} ({usd(a.worstDropAny)})
                      </Text>
                      <Text size="sm" c={s.worstYear.pct < 0 ? 'red' : undefined}>
                        Worst year: {s.worstYear.year}, {usd(a.worstYear)} ({pct(s.worstYear.pct)})
                      </Text>
                      <Stack gap={0}>
                        {p.robust.periods.map((x) => (
                          <Text key={x.from} size="xs" c={x.pct >= x.spyPct ? 'teal' : 'red'}>
                            {periodText(x)}
                          </Text>
                        ))}
                      </Stack>
                      <Text size="xs" c={vsSpy(p.robust).color}>
                        {vsSpy(p.robust).text}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Asks you in Telegram if it falls {p.alertPct}% from its peak.
                      </Text>
                    </>
                  ) : (
                    <Text size="xs" c="dimmed">
                      No test numbers yet.
                    </Text>
                  )}
                </Stack>
              </Paper>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        Tested {since}–today on each year&apos;s 50 most-traded S&amp;P 500 stocks, every period
        scored with settings picked only from earlier data. The ranges come from{' '}
        {data.profiles[0]?.robustMethod} ({data.profiles[0]?.robust?.runs ?? 0} runs). The data
        misses companies that later disappeared, so real results are likely a bit lower. Past
        results, not a promise; not financial advice.
      </Text>
    </Stack>
  );
}
