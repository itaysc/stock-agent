import { Paper, Stack, Text, Title } from '@mantine/core';
import type { InvestmentView } from '../../api/broker-types';

/** How it decides: the profile and its history, the rules, the alert and the monthly check. */
export function BrokerHow({ view }: { view: InvestmentView }) {
  return (
    <Paper p="md" withBorder>
      <Stack gap={4}>
        <Title order={5}>How it decides</Title>
        {view.profile && (
          <Text size="sm">
            <b>{view.profile.name}:</b> {view.profile.summary}
            {view.profileStats &&
              ` Since ${new Date(view.profileStats.from).getUTCFullYear()}: ${view.profileStats.annualPct.toFixed(1)}% a year, worst drop -${view.profileStats.maxDrawdownPct.toFixed(0)}%, worst year ${view.profileStats.worstYear.year} (${view.profileStats.worstYear.pct.toFixed(0)}%).`}
          </Text>
        )}
        <Text size="sm">{view.algo}</Text>
        <Text size="sm" c="dimmed">
          Before each buy it reads the latest news, trading halts and SEC filings, and skips the buy
          on bad news.{' '}
          {view.alertPct
            ? `If it falls ${view.alertPct}% below its peak, it asks you in Telegram whether to sell everything; it never sells it all by itself.`
            : `If it falls ${view.maxDrawdownPct}% below its peak it sells everything and pauses until you resume it.`}{' '}
          Every month it checks that the algo still beats holding the stocks, and warns you if not.
        </Text>
        {view.lastTune && (
          <Text size="xs" c="dimmed">
            Last check ({new Date(view.lastTune.at).toLocaleDateString()}): {view.lastTune.message}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {view.tested}
        </Text>
      </Stack>
    </Paper>
  );
}
