import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Text,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconChartLine,
  IconDownload,
  IconLogout,
  IconMoon,
  IconSparkles,
  IconSun,
} from '@tabler/icons-react';
import { useInstall } from '../pwa/useInstall';
import type { Account } from '../api/account-types';
import { AccountSwitcher } from './AccountSwitcher';
import { useAuth } from './auth/AuthGate';
import { HeaderFunds } from './HeaderFunds';
import { MarketClock } from './MarketClock';
import type { BacktestOptions } from '../api/types';

export type Page = 'broker' | 'trade' | 'tax' | 'lab' | 'paper' | 'accounts';

interface Props {
  options: BacktestOptions;
  onPage: (page: Page) => void;
  accounts: Account[];
}

/** The computer's top bar: the app, the account, the market clock, the money, and settings (the pages are in the sidebar). */
export function Header({ options, onPage, accounts }: Props) {
  const install = useInstall();
  const { setColorScheme } = useMantineColorScheme();
  const { user, logout } = useAuth();
  const scheme = useComputedColorScheme('light');

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon
          size={34}
          radius="md"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'cyan' }}
        >
          <IconChartLine size={20} />
        </ThemeIcon>
        <Box>
          <Text fw={700} lh={1.1}>
            Bullwether
          </Text>
          <Text size="xs" c="dimmed" lh={1.1}>
            your paper broker
          </Text>
        </Box>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <AccountSwitcher accounts={accounts} onManage={() => onPage('accounts')} />
        <MarketClock />
        <HeaderFunds />
        <Tooltip label={`Market data feed; history from ${options.dataStart}`}>
          <Badge variant="light" color="gray" visibleFrom="xs">
            {options.dataFeed.toUpperCase()} data
          </Badge>
        </Tooltip>
        <Tooltip
          label={options.aiEnabled ? 'AI summaries are on' : 'Set OPENAI_API_KEY in server/.env'}
        >
          <Badge
            variant="light"
            color={options.aiEnabled ? 'violet' : 'gray'}
            leftSection={<IconSparkles size={12} />}
            visibleFrom="xs"
          >
            AI {options.aiEnabled ? 'on' : 'off'}
          </Badge>
        </Tooltip>
        {install.canPrompt && !install.installed && (
          <Tooltip label="Install Bullwether as an app">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Install the app"
              onClick={() => void install.install()}
            >
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        {user && (
          <Tooltip label={`Log out ${user.email}`}>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Log out"
              onClick={() => void logout()}
            >
              <IconLogout size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Toggle color scheme"
          onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        >
          {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
      </Group>
    </Group>
  );
}
