import { UnstyledButton, Text } from '@mantine/core';
import { IconBriefcase, IconFlask, IconReceiptTax, IconArrowsExchange } from '@tabler/icons-react';
import type { Page } from '../Header';
import classes from './BottomNav.module.css';

const TABS: Array<{ page: Page; label: string; icon: typeof IconBriefcase }> = [
  { page: 'broker', label: 'Broker', icon: IconBriefcase },
  { page: 'trade', label: 'Trade', icon: IconArrowsExchange },
  { page: 'tax', label: 'Tax', icon: IconReceiptTax },
  { page: 'lab', label: 'Advanced', icon: IconFlask },
];

/** The phone's main navigation: a tab bar at the bottom, in thumb reach, above the home bar. */
export function BottomNav({ page, onPage }: { page: Page; onPage: (p: Page) => void }) {
  const current = page === 'paper' ? 'lab' : page;
  return (
    <nav className={classes.bar} aria-label="Pages">
      {TABS.map(({ page: p, label, icon: Icon }) => {
        const active = current === p;
        return (
          <UnstyledButton
            key={p}
            className={classes.tab}
            data-active={active || undefined}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              onPage(p);
              window.scrollTo({ top: 0 });
            }}
          >
            <Icon size={24} stroke={active ? 2.2 : 1.6} />
            <Text size="xs" fw={active ? 700 : 500} lh={1}>
              {label}
            </Text>
          </UnstyledButton>
        );
      })}
    </nav>
  );
}
