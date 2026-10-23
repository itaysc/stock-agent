import {
  ActionIcon,
  Badge,
  Box,
  Group,
  SegmentedControl,
  Text,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconChartLine, IconLogout, IconMoon, IconSparkles, IconSun } from '@tabler/icons-react';
import type { Account } from '../api/account-types';
import { AccountSwitcher } from './AccountSwitcher';
import { useAuth } from './auth/AuthGate';
import { HeaderFunds } from './HeaderFunds';
import { MarketClock } from './MarketClock';
import type { BacktestOptions } from '../api/types';

export type Page = 'broker' | 'trade' | 'tax' | 'lab' | 'paper' | 'accounts';

interface Props {
  options: BacktestOptions;
  page: Page;
  onPage: (page: Page) => void;
  accounts: Account[];
}

export function Header({ options, page, onPage, accounts }: Props) {
  const { setColorScheme } = useMantineColorScheme();
  const { user, logout } = useAuth();
  const scheme = useComputedColorScheme('light');

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      {/* On a phone the page tabs and the account menu need the room. */}
      <Group gap="sm" wrap="nowrap" visibleFrom="xs">
        <ThemeIcon
          size={34}
          radius="md"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'cyan' }}
        >
          <IconChartLine size={20} />
        </ThemeIcon>
        <Box visibleFrom="sm">
          <Text fw={700} lh={1.1}>
            Bullwether
          </Text>
          <Text size="xs" c="dimmed" lh={1.1}>
            your paper broker
          </Text>
        </Box>
      </Group>
      <SegmentedControl
        size="xs"
        value={
          page === 'broker' || page === 'trade' || page === 'tax'
            ? page
            : page === 'accounts'
              ? ''
              : 'advanced'
        }
        onChange={(v) => onPage(v === 'advanced' ? 'lab' : (v as Page))}
        data={[
          { value: 'broker', label: 'Broker' },
          { value: 'trade', label: 'Trade' },
          { value: 'tax', label: 'Tax' },
          { value: 'advanced', label: 'Advanced' },
        ]}
      />
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
