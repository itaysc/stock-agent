import {
  Burger,
  Divider,
  Drawer,
  Group,
  NavLink,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowsExchange,
  IconBriefcase,
  IconChartLine,
  IconCheck,
  IconUserCircle,
  IconFlask,
  IconLogout,
  IconReceiptTax,
  IconRobot,
  IconUsers,
} from '@tabler/icons-react';
import type { Account } from '../../api/account-types';
import type { BacktestOptions } from '../../api/types';
import { currentAccountId, switchAccount } from '../../lib/account';
import { useAuth } from '../auth/AuthGate';
import type { Page } from '../Header';

const PAGES: Array<{ page: Page; label: string; hint: string; icon: typeof IconBriefcase }> = [
  { page: 'broker', label: 'Broker', hint: 'It invests for you', icon: IconBriefcase },
  { page: 'trade', label: 'Trade', hint: 'Your own buys and sells', icon: IconArrowsExchange },
  { page: 'tax', label: 'Tax', hint: 'Records for the yearly report', icon: IconReceiptTax },
  { page: 'lab', label: 'Lab', hint: 'Backtests and AI research', icon: IconFlask },
  { page: 'paper', label: 'Paper & autopilot', hint: 'Test runs and the agent', icon: IconRobot },
];

/** The phone's menu: a hamburger that slides in a drawer with the account, every page and the settings. */
export function MobileMenu({
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
  const viewing = accounts.find((a) => a.id === currentAccountId()) ?? accounts[0];
  const [opened, { toggle, close }] = useDisclosure(false);
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme('light') === 'dark';
  const { user, logout } = useAuth();
  const go = (p: Page) => {
    onPage(p);
    close();
    window.scrollTo({ top: 0 });
  };
  return (
    <>
      <Burger opened={opened} onClick={toggle} size="sm" aria-label="Menu" p={8} />
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="82%"
        padding="md"
        transitionProps={{ transition: 'slide-left', duration: 220, timingFunction: 'ease-out' }}
        overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
        title={
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              size={34}
              radius="md"
              variant="gradient"
              gradient={{ from: 'indigo', to: 'cyan' }}
            >
              <IconChartLine size={20} />
            </ThemeIcon>
            <div>
              <Text fw={700} lh={1.1}>
                Stock Invest
              </Text>
              <Text size="xs" c="dimmed" lh={1.2}>
                {user?.email ?? 'your paper broker'}
              </Text>
            </div>
          </Group>
        }
        styles={{ body: { paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' } }}
      >
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} px="sm">
            Account
          </Text>
          {accounts.map((a) => {
            const on = a.id === viewing?.id;
            return (
              <NavLink
                key={a.id}
                label={
                  <Text size="sm" fw={on ? 700 : 400}>
                    {a.name}
                  </Text>
                }
                description={`${a.name !== a.id ? `${a.id} · ` : ''}${a.paper ? 'paper' : 'live'} · key …${a.keyHint}`}
                leftSection={<IconUserCircle size={22} stroke={1.6} />}
                rightSection={
                  on ? <IconCheck size={18} color="var(--mantine-color-teal-6)" /> : undefined
                }
                onClick={() => (on ? close() : switchAccount(a.id))}
                styles={{ root: { borderRadius: 8, minHeight: 52 } }}
              />
            );
          })}
          {!accounts.length && (
            <Text size="sm" c="dimmed" px="sm">
              No account yet: add one under Accounts.
            </Text>
          )}
          <Divider my="xs" />
          {PAGES.map(({ page: p, label, hint, icon: Icon }) => (
            <NavLink
              key={p}
              active={page === p}
              label={label}
              description={hint}
              leftSection={<Icon size={22} stroke={1.6} />}
              onClick={() => go(p)}
              styles={{ root: { borderRadius: 8, minHeight: 52 } }}
            />
          ))}
          <Divider my="xs" />
          <NavLink
            active={page === 'accounts'}
            label={user?.admin ? 'Accounts & users' : 'Accounts'}
            description="Your Alpaca accounts"
            leftSection={<IconUsers size={22} stroke={1.6} />}
            onClick={() => go('accounts')}
            styles={{ root: { borderRadius: 8, minHeight: 52 } }}
          />
          <Group justify="space-between" px="sm" py="sm">
            <Text size="sm">Dark mode</Text>
            <Switch
              size="md"
              checked={dark}
              onChange={(e) => setColorScheme(e.currentTarget.checked ? 'dark' : 'light')}
              aria-label="Dark mode"
            />
          </Group>
          <Text size="xs" c="dimmed" px="sm">
            {options.dataFeed.toUpperCase()} market data · AI summaries{' '}
            {options.aiEnabled ? 'on' : 'off'}
          </Text>
          {user && (
            <>
              <Divider my="xs" />
              <NavLink
                label="Log out"
                c="red"
                leftSection={<IconLogout size={22} stroke={1.6} />}
                onClick={() => {
                  close();
                  void logout();
                }}
                styles={{ root: { borderRadius: 8, minHeight: 48 } }}
              />
            </>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
