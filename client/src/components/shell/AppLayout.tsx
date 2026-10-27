import { AppShell } from '@mantine/core';
import type { ReactNode } from 'react';
import type { Account } from '../../api/account-types';
import type { BacktestOptions } from '../../api/types';
import { usePreference } from '../../consent/cookie-consent';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Header, type Page } from '../Header';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { Sidebar } from './Sidebar';

// On a phone the bars leave room for the notch and the home bar (safe areas).
const SAFE_TOP = {
  paddingTop: 'env(safe-area-inset-top)',
  height: 'calc(56px + env(safe-area-inset-top))',
};
const SAFE_BOTTOM = { height: 'calc(64px + env(safe-area-inset-bottom))' };
const SAFE_MAIN = {
  paddingTop: 'calc(56px + env(safe-area-inset-top) + 12px)',
  // Also the room of a page's sticky main action (StickyAction), when it has one.
  paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 24px + var(--sticky-cta, 0px))',
};

/**
 * The app's frame. On a computer: the top bar, and the pages in a sidebar on
 * the left. On a phone: a compact top bar and a tab bar at the bottom.
 */
export function AppLayout({
  options,
  page,
  onPage,
  accounts,
  children,
}: {
  options: BacktestOptions;
  page: Page;
  onPage: (p: Page) => void;
  accounts: Account[];
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  // The computer's sidebar: full, or collapsed to icons (remembered with functional consent).
  const [collapsed, setCollapsed] = usePreference('sidebar-collapsed', false);
  return (
    <AppShell
      header={{ height: mobile ? 56 : 60 }}
      footer={mobile ? { height: 64 } : undefined}
      navbar={
        mobile
          ? undefined
          : { width: collapsed ? 72 : 250, breakpoint: 'sm', collapsed: { mobile: true } }
      }
      padding="md"
    >
      <AppShell.Header style={mobile ? SAFE_TOP : undefined}>
        {mobile ? (
          <MobileHeader options={options} page={page} onPage={onPage} accounts={accounts} />
        ) : (
          <Header options={options} onPage={onPage} accounts={accounts} />
        )}
      </AppShell.Header>
      {!mobile && (
        <AppShell.Navbar style={{ transition: 'width 200ms ease' }}>
          <Sidebar
            page={page}
            onPage={onPage}
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
          />
        </AppShell.Navbar>
      )}
      {mobile && (
        <AppShell.Footer style={SAFE_BOTTOM}>
          <BottomNav page={page} onPage={onPage} />
        </AppShell.Footer>
      )}
      <AppShell.Main style={mobile ? SAFE_MAIN : undefined}>{children}</AppShell.Main>
    </AppShell>
  );
}
