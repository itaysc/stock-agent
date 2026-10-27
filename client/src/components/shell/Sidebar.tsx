import {
  ActionIcon,
  Anchor,
  AppShell,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { openCookieSettings } from '../../consent/cookie-consent';
import { useAuth } from '../auth/AuthGate';
import type { Page } from '../Header';
import { accountsPage, NAV_PAGES, type NavPage } from './pages';
import classes from './Sidebar.module.css';

/**
 * The computer's page list on the left: the pages, then Accounts, and the
 * legal links. It collapses to a column of icons (their names in tooltips)
 * with the button at its bottom.
 */
export function Sidebar({
  page,
  onPage,
  collapsed,
  onToggle,
}: {
  page: Page;
  onPage: (p: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();
  const go = (p: Page) => {
    onPage(p);
    window.scrollTo({ top: 0 });
  };
  const link = ({ page: p, label, hint, icon: Icon }: NavPage) =>
    collapsed ? (
      <Tooltip key={p} label={label} position="right" withArrow>
        <ActionIcon
          size={44}
          radius="md"
          variant={page === p ? 'light' : 'subtle'}
          color={page === p ? undefined : 'gray'}
          aria-label={label}
          aria-current={page === p ? 'page' : undefined}
          onClick={() => go(p)}
        >
          <Icon size={22} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
    ) : (
      <NavLink
        key={p}
        active={page === p}
        label={label}
        description={hint}
        leftSection={<Icon size={20} stroke={1.6} />}
        onClick={() => go(p)}
        styles={{ root: { borderRadius: 8 } }}
      />
    );
  const Toggle = collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse;
  return (
    <>
      <AppShell.Section grow component={ScrollArea} p="sm">
        {collapsed ? (
          <Stack gap={6} align="center">
            {NAV_PAGES.map(link)}
            <Divider my={4} w="100%" />
            {link(accountsPage(!!user?.admin))}
          </Stack>
        ) : (
          <>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} px="sm" pb={4}>
              Pages
            </Text>
            {NAV_PAGES.map(link)}
            <Divider my="sm" />
            {link(accountsPage(!!user?.admin))}
          </>
        )}
      </AppShell.Section>
      <AppShell.Section p="sm">
        {!collapsed && (
          <Group gap="md" justify="center" pb="xs" style={{ rowGap: 6 }}>
            <Anchor href="/terms" target="_blank" size="xs" c="dimmed">
              Terms of Use
            </Anchor>
            <Anchor href="/policy" target="_blank" size="xs" c="dimmed">
              Privacy Policy
            </Anchor>
            <Anchor href="/accessibility" target="_blank" size="xs" c="dimmed">
              Accessibility
            </Anchor>
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="dimmed"
              onClick={openCookieSettings}
            >
              Cookie preferences
            </Anchor>
          </Group>
        )}
        <Tooltip label="Expand" position="right" withArrow disabled={!collapsed}>
          <UnstyledButton
            className={classes.toggle}
            data-collapsed={collapsed || undefined}
            onClick={onToggle}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          >
            <Toggle size={20} stroke={1.6} />
            {!collapsed && <span>Collapse</span>}
          </UnstyledButton>
        </Tooltip>
      </AppShell.Section>
    </>
  );
}
