import { Anchor, AppShell, Divider, Group, NavLink, ScrollArea, Text } from '@mantine/core';
import { useAuth } from '../auth/AuthGate';
import type { Page } from '../Header';
import { accountsPage, NAV_PAGES, type NavPage } from './pages';

/** The computer's page list on the left: the pages, then Accounts, and the legal links at the bottom. */
export function Sidebar({ page, onPage }: { page: Page; onPage: (p: Page) => void }) {
  const { user } = useAuth();
  const link = ({ page: p, label, hint, icon: Icon }: NavPage) => (
    <NavLink
      key={p}
      active={page === p}
      label={label}
      description={hint}
      leftSection={<Icon size={20} stroke={1.6} />}
      onClick={() => {
        onPage(p);
        window.scrollTo({ top: 0 });
      }}
      styles={{ root: { borderRadius: 8 } }}
    />
  );
  return (
    <>
      <AppShell.Section grow component={ScrollArea} p="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} px="sm" pb={4}>
          Pages
        </Text>
        {NAV_PAGES.map(link)}
        <Divider my="sm" />
        {link(accountsPage(!!user?.admin))}
      </AppShell.Section>
      <AppShell.Section p="md">
        <Group gap="md">
          <Anchor href="/terms" target="_blank" size="xs" c="dimmed">
            Terms of Use
          </Anchor>
          <Anchor href="/policy" target="_blank" size="xs" c="dimmed">
            Privacy Policy
          </Anchor>
        </Group>
      </AppShell.Section>
    </>
  );
}
