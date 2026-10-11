import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconDownload, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { TaxReport, TaxYears } from '../../api/tax-types';
import { shekels, timeAgo } from '../../lib/format';
import { TaxRecords } from './TaxRecords';
import { TaxSales } from './TaxSales';

const stat = (label: string, value: string, hint: string, color?: string) => (
  <Paper p="sm" withBorder>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text fw={700} c={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Text>
    <Text size="xs" c="dimmed">
      {hint}
    </Text>
  </Paper>
);

/** Every buy and sell with its shekel value, and the year's tax picture for the yearly report. */
export function TaxPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [paper, setPaper] = useState(true);
  const [years, setYears] = useState<TaxYears | null>(null);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [y, r] = await Promise.all([api.taxYears(), api.taxReport(year, paper)]);
      setYears(y);
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [year, paper]);
  useEffect(() => void load(), [load]);

  const sync = async () => {
    setSyncing(true);
    await api.taxSync().catch((e: Error) => setError(e.message));
    setSyncing(false);
    void load();
  };
  const yearList = [...new Set([thisYear, ...(years?.years ?? []).map((y) => y.year)])].sort(
    (a, b) => b - a,
  );
  const r = report;
  const net = r ? r.totals.realNetIls - r.income.feesIls : 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={3}>Tax records</Title>
          <Text size="sm" c="dimmed">
            Every buy and sell, copied from the broker with the Bank of Israel dollar rate of its
            day.
          </Text>
        </div>
        <Group gap="xs">
          <Select
            size="xs"
            w={100}
            value={String(year)}
            onChange={(v) => v && setYear(Number(v))}
            data={yearList.map(String)}
            allowDeselect={false}
          />
          <SegmentedControl
            size="xs"
            value={paper ? 'paper' : 'real'}
            onChange={(v) => setPaper(v === 'paper')}
            data={[
              { value: 'paper', label: 'Paper' },
              { value: 'real', label: 'Real money' },
            ]}
          />
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            loading={syncing}
            onClick={() => void sync()}
          >
            Sync now
          </Button>
        </Group>
      </Group>
      {years?.lastSync && (
        <Text size="xs" c={years.lastSync.error ? 'red' : 'dimmed'}>
          Last copied from the broker {timeAgo(years.lastSync.at)}
          {years.lastSync.error
            ? ` (failed: ${years.lastSync.error})`
            : ` (${years.lastSync.added} new)`}
          . It copies new activity every hour.
        </Text>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {!r ? (
        <Loader size="sm" />
      ) : (
        <>
          <Group gap="xs">
            <Title order={5}>{r.year}</Title>
            <Badge variant="light" color={paper ? 'gray' : 'teal'}>
              {paper ? 'paper: practice only' : 'real money'}
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {stat('Sales', String(r.sales.length), `${shekels(r.totals.proceedsIls)} sold`)}
            {stat('Net gain', shekels(net), 'after fees, dollar method', net >= 0 ? 'teal' : 'red')}
            {stat(
              'Losses carried',
              shekels(r.carriedOutIls),
              `to next year (${shekels(r.carriedInIls)} came in)`,
            )}
            {stat('Estimated tax', shekels(r.estimatedTaxIls), '25%, rough estimate')}
          </SimpleGrid>
          <Paper p="sm" withBorder>
            <Stack gap={4}>
              {r.notes.map((n) => (
                <Text key={n} size="sm">
                  • {n}
                </Text>
              ))}
              <Text size="xs" c="dimmed">
                Gains: {shekels(r.totals.gainsIls)} · losses: {shekels(r.totals.lossesIls)} · in
                plain shekels (shekels in − out): {shekels(r.totals.netIls)} · dividends{' '}
                {shekels(r.income.dividendsIls)} · US tax withheld {shekels(r.income.withheldIls)} ·
                interest {shekels(r.income.interestIls)} · fees {shekels(r.income.feesIls)}
              </Text>
            </Stack>
          </Paper>
          <Group>
            <Anchor
              href={`/api/v1/tax/sales.csv?year=${year}&paper=${paper}`}
              download={`sales-${year}${paper ? '-paper' : ''}.csv`}
              size="sm"
            >
              <Group gap={4}>
                <IconDownload size={14} /> Download the sales (CSV, for form 1322 or your
                accountant)
              </Group>
            </Anchor>
          </Group>
          <TaxSales sales={r.sales} holdings={r.holdings} valuedOn={r.valuedOn} />
          <TaxRecords year={year} paper={paper} />
        </>
      )}
    </Stack>
  );
}
