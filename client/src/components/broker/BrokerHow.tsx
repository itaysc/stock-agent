import { Paper, Stack, Text, Title } from '@mantine/core';
import type { InvestmentView } from '../../api/broker-types';
import { usualRange, vsSpy } from '../../lib/robust';

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
              view.profileRobust &&
              ` In tests since ${new Date(view.profileStats.from).getUTCFullYear()}: usually ${usualRange(view.profileRobust)} a year, worst drop up to -${view.profileRobust.worstDropPct.toFixed(0)}%, worst year ${view.profileStats.worstYear.year} (${view.profileStats.worstYear.pct.toFixed(0)}%). ${vsSpy(view.profileRobust).text}.`}
          </Text>
        )}
        <Text size="sm">{view.algo}</Text>
        <Text size="sm" c="dimmed">
          Before each buy it reads the latest news, trading halts and SEC filings, and skips the buy
          on bad news. If the stock reports earnings within a few days, it waits until after the
          report and buys only if the report is fine.{' '}
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
