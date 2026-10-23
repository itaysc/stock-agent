import { Group, Text } from '@mantine/core';
import type { Account } from '../../api/account-types';
import type { BacktestOptions } from '../../api/types';
import type { Page } from '../Header';
import { MarketClock } from '../MarketClock';
import { MobileMenu } from './MobileMenu';

const TITLES: Record<Page, string> = {
  broker: 'Broker',
  trade: 'Trade',
  tax: 'Tax',
  lab: 'Advanced',
  paper: 'Advanced',
  accounts: 'Accounts',
};

/** The phone's top bar: the page name and market status; the menu (pages, account, settings) on the right. */
export function MobileHeader({
  options,
  page,
  onPage,
  accounts,
}: {
  options: BacktestOptions;
  page: Page;
  onPage: (p: Page) => void;
  accounts: Account[];
}) {
  return (
    <Group h="100%" pl="md" pr="sm" justify="space-between" wrap="nowrap" gap="xs">
      <div style={{ minWidth: 0 }}>
        <Text fw={700} size="lg" lh={1.15} truncate>
          {TITLES[page]}
        </Text>
        <MarketClock compact />
      </div>
      <MobileMenu options={options} page={page} onPage={onPage} accounts={accounts} />
    </Group>
  );
}
